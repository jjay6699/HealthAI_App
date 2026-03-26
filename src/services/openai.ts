import { AVAILABLE_SUPPLEMENTS } from "../data/supplements";
import { SUPPLEMENT_DESCRIPTIONS } from "../data/supplementDescriptions";
import { pdfToImages, extractStructuredTextPagesFromPdf, extractTextFromPdf } from "../utils/pdfProcessor";
import { extractStructuredTextFromImage } from "../utils/imageOcr";
import { createBloodworkFocusCrop, cropImageBands, preprocessBloodworkImage } from "../utils/imagePreprocess";
import { persistentStorage } from "./persistentStorage";
import type { Language } from "../i18n";

interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: string;
    content: unknown;
  }>;
  response_format?: { type: "json_object" };
  temperature?: number;
  max_tokens?: number;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string | null;
    };
  }>;
}

const createChatCompletion = async (
  payload: ChatCompletionRequest
): Promise<ChatCompletionResponse> => {
  const response = await fetch("/api/ai/chat-completions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
};

const ANALYSIS_CACHE_VERSION = "v37";
const ANALYSIS_TEMPERATURE = 0;
const LANGUAGE_STORAGE_KEY = "appLanguage";

const ANALYSIS_MODEL = "gpt-4o";
const VISUAL_PRIMARY_BOUNDARY_TEXT = "__PRIMARY_VISUAL_IMAGES_END__";

const normalizeImageMimeType = (fileType: string) => {
  if (fileType.includes("jpeg") || fileType.includes("jpg")) {
    return "image/jpeg";
  }
  if (fileType.includes("png")) {
    return "image/png";
  }
  if (fileType.includes("gif")) {
    return "image/gif";
  }
  if (fileType.includes("webp")) {
    return "image/webp";
  }
  return "image/jpeg";
};

const fileToBase64Data = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
  });

const BLOODWORK_EXTRACTION_RULES = `Extraction requirements:
- Review every row in every table before summarizing. Do not skip urinalysis/FEME/urine chemistry, hematology, biochemistry, hormones, inflammatory markers, microscopy, or any appendix page.
- Treat asterisk/star/flag markers, H/L markers, bolded values, and values outside the printed reference range as abnormal.
- Concerns must include every detected abnormal or flagged marker, even if the deviation is mild or borderline.
- If a marker has a value and a reference range, compare them numerically when possible instead of relying only on visual flag icons.
- Apply the same exhaustive extraction standard to every section of the report, including urinalysis, hematology, red/white cell indices, platelets, electrolytes, renal markers, liver markers, lipids, glucose markers, thyroid markers, vitamins, minerals, inflammatory markers, hormones, microscopy, and any other reported panels.
- Do not prioritize only the most common or highest-level markers. Low-visibility, borderline, uncommon, or non-blood markers must still be extracted and checked against range.
- If a report mixes normal and abnormal findings, do not omit the abnormal ones just because there are larger abnormalities elsewhere.
- If a marker is present but the reference range is cut off or partially obscured, still mention the marker and state that the range was partially unreadable if needed.
- The summary can be concise, but concerns must be exhaustive for abnormal findings.`;

export interface BloodworkData {
  [key: string]: {
    value: number;
    unit: string;
    referenceRange?: string;
  };
}

export interface SupplementRecommendation {
  supplementId: string;
  supplementName: string;
  reason: string;
  priority: "high" | "medium" | "low";
  dosage?: string;
  dosageGramsPerDay?: number;
}

export interface ParsedReportRow {
  markerId: string;
  panel?: string;
  marker: string;
  value?: string;
  unit?: string;
  referenceRange?: string;
  status: "high" | "low" | "normal" | "abnormal" | "flagged" | "comment" | "unknown";
  note?: string;
  explanation?: string;
  source?: "deterministic" | "ai" | "validated";
}

export interface BloodworkAnalysis {
  summary: string;
  concerns: string[];
  strengths: string[];
  recommendations: SupplementRecommendation[];
  detailedInsights: {
    category: string;
    findings: string;
    impact: string;
  }[];
  parsedRows?: ParsedReportRow[];
  extractionCompleteness?: "complete" | "partial" | "low-confidence";
  missingVisibleRowsCount?: number;
  parsingDebug?: {
    rawRowCount: number;
    finalRowCount: number;
    derivedMarkerIds?: string[];
    candidateRowCount?: number;
    panelCounts?: Record<string, number>;
  };
}

interface VerifiedAbnormalMarker {
  panel?: string;
  marker: string;
  value?: string;
  referenceRange?: string;
  abnormalDirection?: "high" | "low" | "abnormal" | "flagged";
  note?: string;
}

interface ExtractedReportRow {
  panel?: string;
  marker: string;
  value?: string;
  unit?: string;
  referenceRange?: string;
  status?: "high" | "low" | "normal" | "abnormal" | "flagged" | "comment" | "unknown";
  note?: string;
  whyItMatters?: string;
  source?: "deterministic" | "ai" | "validated";
}

interface SourceToken {
  text: string;
  x: number;
  y: number;
}

interface SourceRowBand {
  pageNumber?: number;
  y?: number;
  text: string;
  tokens?: SourceToken[];
}

interface TableColumnAnchors {
  resultX: number;
  unitX: number;
  rangeX: number;
}

const concernStatusSet = new Set(["high", "low", "abnormal", "flagged"]);
const EXPECTED_COMMON_MARKERS = [
  "ESR",
  "Total Cholesterol",
  "Triglycerides",
  "HDL Cholesterol",
  "LDL Cholesterol",
  "Non HDL",
  "Glucose",
  "HbA1c",
  "hs C-Reactive Protein",
  "Total Bilirubin",
  "Total Protein",
  "Albumin",
  "Globulin",
  "A/G ratio",
  "ALP",
  "ALT (SGPT)",
  "AST (SGOT)",
  "GGT",
  "Hemoglobin",
  "PCV (HCT)",
  "RBC Count",
  "MCV",
  "MCH",
  "MCHC",
  "RDW (CV)",
  "RDW-SD",
  "Total WBC Count",
  "Neutrophil-Lymphocyte Ratio (NLR)",
  "Lymphocyte-Monocyte Ratio (LMR)",
  "Platelet-Lymphocyte Ratio (PLR)",
  "Neutrophils",
  "Lymphocytes",
  "Monocytes",
  "Eosinophils",
  "Basophils",
  "Absolute Neutrophil Count (ANC)",
  "Absolute Lymphocyte Count (ALC)",
  "Absolute Monocyte Count",
  "Absolute Eosinophil Count (AEC)",
  "Absolute Basophil Count",
  "Platelets Count"
] as const;

const MARKER_DEFINITIONS: Array<{ marker: string; patterns: RegExp[] }> = [
  { marker: "ESR", patterns: [/^esr\b/i, /^erythrocyte sedimentation rate\b/i] },
  { marker: "Total Cholesterol", patterns: [/^total cholesterol\b/i] },
  { marker: "Triglycerides", patterns: [/^triglycerides\b/i] },
  { marker: "HDL Cholesterol", patterns: [/^hdl cholesterol\b/i, /^high density lipoprotein\b/i] },
  { marker: "LDL Cholesterol", patterns: [/^ldl cholesterol\b/i, /^low density lipoprotein\b/i] },
  { marker: "Non HDL", patterns: [/^non hdl\b/i, /^non[-\s]?hdl\b/i] },
  { marker: "Glucose", patterns: [/^glucose\b/i, /^fasting glucose\b/i, /^blood glucose\b/i] },
  { marker: "HbA1c", patterns: [/^hba1c\b/i, /^hb a1c\b/i, /^hba1c\s*\(hplc\)\b/i, /^glycated hemoglobin\b/i] },
  { marker: "hs C-Reactive Protein", patterns: [/^hs c[-\s]?reactive protein\b/i, /^hscrp\b/i] },
  { marker: "Total Bilirubin", patterns: [/^total bilirubin\b/i] },
  { marker: "Total Protein", patterns: [/^total protein\b/i] },
  { marker: "Albumin", patterns: [/^albumin\b/i] },
  { marker: "Globulin", patterns: [/^globulin\b/i] },
  { marker: "A/G ratio", patterns: [/^a\/g ratio\b/i, /^a g ratio\b/i] },
  { marker: "ALP", patterns: [/^alp\b/i, /^alkaline phosphatase\b/i] },
  { marker: "ALT (SGPT)", patterns: [/^alt\s*\(sgpt\)\b/i, /^alt\b/i] },
  { marker: "AST (SGOT)", patterns: [/^ast\s*\(sgot\)\b/i, /^ast\b/i] },
  { marker: "GGT", patterns: [/^ggt\b/i] },
  { marker: "Hemoglobin", patterns: [/^hemoglobin\b/i, /^haemoglobin\b/i] },
  { marker: "PCV (HCT)", patterns: [/^pcv\s*\(hct\)\b/i, /^pcv\b/i, /^hct\b/i, /^hematocrit\b/i, /^haematocrit\b/i] },
  { marker: "RBC Count", patterns: [/^rbc count\b/i, /^rbc\b/i] },
  { marker: "MCV", patterns: [/^mcv\b/i] },
  { marker: "MCH", patterns: [/^mch\b/i] },
  { marker: "MCHC", patterns: [/^mchc\b/i] },
  { marker: "RDW-SD", patterns: [/^rdw\s*[-–—]?\s*sd\b/i] },
  { marker: "RDW (CV)", patterns: [/^rdw\s*\(cv\)\b/i, /^rdw\s*[-–—]?\s*cv\b/i, /^rdw value\b/i, /^rdw\b/i] },
  { marker: "Total WBC Count", patterns: [/^total wbc count\b/i, /^wbc count\b/i, /^wbc\b/i, /^tlc\b/i, /^total leucocyte count\b/i, /^total leukocyte count\b/i] },
  {
    marker: "Neutrophil-Lymphocyte Ratio (NLR)",
    patterns: [/^neutrophil\s*[-–—]\s*lymphocyte ratio\b/i, /^neutrophil\s*lymphocyte ratio\b/i, /^nlr\b/i]
  },
  {
    marker: "Lymphocyte-Monocyte Ratio (LMR)",
    patterns: [/^lymphocyte\s*[-–—]\s*monocyte ratio\b/i, /^lymphocyte\s*monocyte ratio\b/i, /^lmr\b/i]
  },
  {
    marker: "Platelet-Lymphocyte Ratio (PLR)",
    patterns: [/^platelet\s*[-–—]\s*lymphocyte ratio\b/i, /^platelet\s*lymphocyte ratio\b/i, /^plr\b/i]
  },
  { marker: "Neutrophils", patterns: [/^neutrophils?\b/i] },
  { marker: "Polymorphs", patterns: [/^polymorphs\b/i] },
  { marker: "Lymphocytes", patterns: [/^lymphocytes?\b/i] },
  { marker: "Monocytes", patterns: [/^monocytes?\b/i] },
  { marker: "Eosinophils", patterns: [/^eosinophils?\b/i] },
  { marker: "Basophils", patterns: [/^basophils?\b/i] },
  { marker: "Absolute Neutrophil Count (ANC)", patterns: [/^absolute neutrophil count\s*\(anc\)\b/i, /^absolute neutrophil count\b/i] },
  { marker: "Absolute Lymphocyte Count (ALC)", patterns: [/^absolute lymphocyte count\s*\(alc\)\b/i, /^absolute lymphocyte count\b/i] },
  { marker: "Absolute Monocyte Count", patterns: [/^absolute monocyte count\b/i] },
  { marker: "Absolute Eosinophil Count (AEC)", patterns: [/^absolute eosinophil count\s*\(aec\)\b/i, /^absolute eosinophil count\b/i] },
  { marker: "Absolute Basophil Count", patterns: [/^absolute basophil count\b/i, /^absolute basophils count\b/i, /^absolute basophils\b/i] },
  { marker: "Platelets Count", patterns: [/^platelets count\b/i, /^platelet count\b/i, /^platelet\b/i] },
  { marker: "URINE MICROALBUMIN", patterns: [/^urine microalbumin\b/i] },
  { marker: "URINE CREATININE", patterns: [/^urine creatinine\b/i] },
  {
    marker: "MICROALB:CREAT RATIO",
    patterns: [
      /^microalb\s*[:\/]\s*creat\s*ratio\b/i,
      /^microalbumin\s*[:\/]\s*creat\s*ratio\b/i,
      /^microalbumin\s*[:\/]\s*creatinine\s*ratio\b/i
    ]
  }
];

const PANEL_PATTERNS = [
  /lipid studies/i,
  /lipid profile/i,
  /liver function test/i,
  /liver function tests/i,
  /hematology/i,
  /haematology/i,
  /complete blood picture/i,
  /complete blood count/i,
  /kidney function tests?/i,
  /renal function tests?/i,
  /renal function/i,
  /thyroid/i,
  /urinalysis/i,
  /differential count/i,
  /diabetes screen/i,
  /hepatitis screen/i
];

const TABLE_HEADER_PATTERN =
  /^(test name|result|unit|reference range|investigation|observed value|biological ref range|method|page|patient|branch id|pathlab no|specimen|species|sex|age|regd|coll|prnt|ref no)\b/i;

const COMMENT_ROW_PATTERN =
  /^(note|comments?|blood picture|wbcs|platelet-count|pbf|rbcs?\b.*|platelets?\b.*adequate|no early wbcs? seen)\s*:?\s*(.*)$/i;

const REFERENCE_ONLY_PATTERN =
  /^(pre[-\s]?diabetes|diabetes|normal\b|fasting\b|non[-\s]?fasting\b|low risk\b|average risk\b|high risk\b|individualised hba1c targets|diagnosis value|recommended|please note)\b/i;

const supplementById = new Map(AVAILABLE_SUPPLEMENTS.map((s) => [s.id, s]));
const supplementByName = new Map(
  AVAILABLE_SUPPLEMENTS.map((s) => [s.name.toLowerCase(), s])
);

const normalizeRecommendations = (analysis: BloodworkAnalysis): BloodworkAnalysis => {
  let normalized = (analysis.recommendations || [])
    .map((rec) => {
      const nameKey = rec.supplementName?.toLowerCase().trim();
      if (nameKey?.startsWith("just ")) {
        return null;
      }

      const byId = supplementById.get(rec.supplementId);
      if (byId) {
        return {
          ...rec,
          supplementId: byId.id,
          supplementName: byId.name
        };
      }

      const byName = nameKey ? supplementByName.get(nameKey) : undefined;
      if (byName) {
        return {
          ...rec,
          supplementId: byName.id,
          supplementName: byName.name
        };
      }

      return null;
    })
    .filter((rec): rec is SupplementRecommendation => Boolean(rec));

  const proteinBases = ["Pea Protein Original", "Pea Protein Cacao"];
  const fiberBases = ["Australian Instant Oats", "Organic Psyllium Husk"];
  const hasProteinBase = normalized.some((rec) => proteinBases.includes(rec.supplementName));
  const hasFiberBase = normalized.some((rec) => fiberBases.includes(rec.supplementName));

  const analysisText = [
    analysis.summary,
    ...(analysis.concerns || []),
    ...(analysis.strengths || []),
    ...(analysis.detailedInsights || []).flatMap((insight) => [insight.category, insight.findings, insight.impact])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const pickProteinBase = () => {
    if (/(stress|anxiety|mood|sleep|fatigue|energy|cognitive|focus)/i.test(analysisText)) {
      return "Pea Protein Cacao";
    }
    return "Pea Protein Original";
  };

  const pickFiberBase = () => {
    if (/(cholesterol|ldl|triglycer|glucose|a1c|insulin|constipation|fiber|gut|digestion)/i.test(analysisText)) {
      return "Organic Psyllium Husk";
    }
    return "Australian Instant Oats";
  };

  if (!hasProteinBase) {
    const proteinChoice = pickProteinBase();
    const proteinSupplement = AVAILABLE_SUPPLEMENTS.find((s) => s.name === proteinChoice);
    if (proteinSupplement) {
      normalized.push({
        supplementId: proteinSupplement.id,
        supplementName: proteinSupplement.name,
        reason: "Base blend protein component selected from your bloodwork insights.",
        priority: "low"
      });
    }
  }

  if (!hasFiberBase) {
    const fiberChoice = pickFiberBase();
    const fiberSupplement = AVAILABLE_SUPPLEMENTS.find((s) => s.name === fiberChoice);
    if (fiberSupplement) {
      normalized.push({
        supplementId: fiberSupplement.id,
        supplementName: fiberSupplement.name,
        reason: "Base blend fiber component selected from your bloodwork insights.",
        priority: "low"
      });
    }
  }

  if (normalized.length > 8) {
    normalized = normalized.slice(0, 8);
  }

  return { ...analysis, recommendations: normalized };
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
};

const hashString = (input: string): string => {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
};

const getCachedAnalysis = (cacheKey: string): BloodworkAnalysis | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = persistentStorage.getItem(cacheKey);
    if (!raw) return null;
    return JSON.parse(raw) as BloodworkAnalysis;
  } catch {
    return null;
  }
};

const setCachedAnalysis = (cacheKey: string, analysis: BloodworkAnalysis) => {
  if (typeof window === "undefined") return;
  try {
    persistentStorage.setItem(cacheKey, JSON.stringify(analysis));
  } catch {
    // Ignore storage errors (quota, privacy mode).
  }
};

const buildAnalysisCacheKey = (kind: string, payload: unknown): string => {
  const base = stableStringify({
    version: ANALYSIS_CACHE_VERSION,
    kind,
    model: ANALYSIS_MODEL,
    payload
  });
  return `analysis:${hashString(base)}`;
};

const normalizeForMatch = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, " ")
    .trim();

const getMarkerAliases = (marker: string) => {
  const normalized = normalizeForMatch(marker);
  const aliases = new Set<string>([normalized]);

  if (/\bldl\b|low density lipoprotein/.test(normalized)) {
    aliases.add("ldl");
    aliases.add("ldl cholesterol");
    aliases.add("low density lipoprotein");
  }
  if (/\bhdl\b|high density lipoprotein/.test(normalized)) {
    aliases.add("hdl");
    aliases.add("hdl cholesterol");
    aliases.add("high density lipoprotein");
  }
  if (/total cholesterol/.test(normalized)) {
    aliases.add("total cholesterol");
    aliases.add("cholesterol");
  }
  if (/triglycer/.test(normalized)) {
    aliases.add("triglycerides");
    aliases.add("tg");
  }
  if (/non hdl/.test(normalized)) {
    aliases.add("non hdl");
    aliases.add("non hdl cholesterol");
  }
  if (/hba1c|hb a1c|glycated hemoglobin/.test(normalized)) {
    aliases.add("hba1c");
    aliases.add("hba1c hplc");
    aliases.add("hb a1c");
  }
  if (/glucose/.test(normalized)) {
    aliases.add("glucose");
    aliases.add("fasting glucose");
    aliases.add("blood glucose");
  }
  if (/esr|erythrocyte sedimentation rate/.test(normalized)) {
    aliases.add("esr");
  }
  if (/platelet/.test(normalized)) {
    aliases.add("platelet count");
    aliases.add("platelets count");
  }
  if (/neutrophil|polymorph/.test(normalized)) {
    aliases.add("neutrophils");
    aliases.add("neutrophil");
    aliases.add("polymorphs");
    aliases.add("polymorph");
  }
  if (/alt|sgpt/.test(normalized)) {
    aliases.add("alt");
    aliases.add("sgpt");
    aliases.add("alt sgpt");
  }
  if (/ast|sgot/.test(normalized)) {
    aliases.add("ast");
    aliases.add("sgot");
    aliases.add("ast sgot");
  }
  if (/alp/.test(normalized)) {
    aliases.add("alp");
  }
  if (/urine microalbumin|microalbumin urine/.test(normalized)) {
    aliases.add("urine microalbumin");
    aliases.add("microalbumin");
  }
  if (/urine creatinine|creatinine urine/.test(normalized)) {
    aliases.add("urine creatinine");
  }
  if (/microalb creat ratio|microalbumin creat ratio|microalbumin creatinine ratio/.test(normalized)) {
    aliases.add("microalb creat ratio");
    aliases.add("microalbumin creat ratio");
    aliases.add("microalbumin creatinine ratio");
  }

  return [...aliases];
};

const collectTextFragments = (input: unknown): string[] => {
  if (typeof input === "string") {
    return [input];
  }

  if (Array.isArray(input)) {
    return input.flatMap((item) => collectTextFragments(item));
  }

  if (input && typeof input === "object") {
    return Object.values(input as Record<string, unknown>).flatMap((value) =>
      collectTextFragments(value)
    );
  }

  return [];
};

const reportContentHasVisualInput = (input: unknown): boolean => {
  if (Array.isArray(input)) {
    return input.some((item) => reportContentHasVisualInput(item));
  }

  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    if (record.type === "image_url") {
      return true;
    }
    return Object.values(record).some((value) => reportContentHasVisualInput(value));
  }

  return false;
};

const getVisualOnlyReportContent = (reportContent: unknown) => {
  if (!Array.isArray(reportContent)) {
    return reportContent;
  }

  const imageItems = reportContent.filter(
    (item) => item && typeof item === "object" && (item as { type?: string }).type === "image_url"
  );

  if (imageItems.length === 0) {
    return reportContent;
  }

  return [
    {
      type: "text" as const,
      text: "Read the uploaded report images directly. Treat the images as the source of truth."
    },
    ...imageItems
  ];
};

const getPrimaryVisualReportContent = (reportContent: unknown, maxImages = 8) => {
  if (!Array.isArray(reportContent)) {
    return reportContent;
  }

  const boundaryIndex = reportContent.findIndex(
    (item) =>
      item &&
      typeof item === "object" &&
      (item as { type?: string; text?: string }).type === "text" &&
      (item as { type?: string; text?: string }).text === VISUAL_PRIMARY_BOUNDARY_TEXT
  );

  const sourceItems = boundaryIndex >= 0 ? reportContent.slice(0, boundaryIndex) : reportContent;
  const nonImageItems = sourceItems.filter(
    (item) => !(item && typeof item === "object" && (item as { type?: string }).type === "image_url")
  );
  const imageItems = sourceItems.filter(
    (item) => item && typeof item === "object" && (item as { type?: string }).type === "image_url"
  );

  if (imageItems.length === 0) {
    return reportContent;
  }

  return [
    ...nonImageItems,
    {
      type: "text" as const,
      text: "Use these primary full-page images for canonical row extraction."
    },
    ...imageItems.slice(0, maxImages)
  ];
};

const getFirstPagePrimaryVisualReportContent = (reportContent: unknown, imagesPerPage = 3) => {
  if (!Array.isArray(reportContent)) {
    return reportContent;
  }

  const boundaryIndex = reportContent.findIndex(
    (item) =>
      item &&
      typeof item === "object" &&
      (item as { type?: string; text?: string }).type === "text" &&
      (item as { type?: string; text?: string }).text === VISUAL_PRIMARY_BOUNDARY_TEXT
  );

  const sourceItems = boundaryIndex >= 0 ? reportContent.slice(0, boundaryIndex) : reportContent;
  const nonImageItems = sourceItems.filter(
    (item) => !(item && typeof item === "object" && (item as { type?: string }).type === "image_url")
  );
  const imageItems = sourceItems.filter(
    (item) => item && typeof item === "object" && (item as { type?: string }).type === "image_url"
  );

  if (imageItems.length <= imagesPerPage) {
    return sourceItems;
  }

  return [
    ...nonImageItems,
    {
      type: "text" as const,
      text: "Use only first-page images for Differential Count disambiguation."
    },
    ...imageItems.slice(0, imagesPerPage)
  ];
};

const collectNormalizedReportLines = (reportContent: unknown) =>
  collectTextFragments(reportContent)
    .flatMap((fragment) => fragment.split(/\r?\n/))
    .map((line) => normalizeForMatch(line))
    .filter(Boolean);

const reportExplicitlyMentionsMarker = (reportContent: unknown, marker: string) => {
  const normalizedReportText = normalizeForMatch(collectTextFragments(reportContent).join(" "));
  if (!normalizedReportText) return false;

  return getMarkerAliases(marker).some((alias) => normalizedReportText.includes(alias));
};

const rowHasExplicitTextEvidence = (reportContent: unknown, row: ExtractedReportRow) => {
  const reportLines = collectNormalizedReportLines(reportContent);
  const matchingLineIndexes = reportLines
    .map((line, index) =>
      getMarkerAliases(row.marker).some((alias) => line.includes(alias)) ? index : -1
    )
    .filter((index) => index >= 0);

  if (matchingLineIndexes.length === 0) return false;
  if (row.status === "comment") return true;
  if (!row.value && !row.referenceRange) return true;

  return matchingLineIndexes.some((index) => {
    const window = reportLines.slice(Math.max(0, index - 2), Math.min(reportLines.length, index + 3));
    const hasValue =
      !row.value ||
      window.some((line) => line.includes(normalizeForMatch(row.value || "")));
    const rangeNumbers = (row.referenceRange || "").match(/\d+(?:\.\d+)?/g) || [];
    const hasRange =
      !row.referenceRange ||
      rangeNumbers.length === 0 ||
      window.some((line) => rangeNumbers.some((num) => line.includes(num)));

    return hasValue || hasRange;
  });
};

const rowMatchesCandidateText = (row: ExtractedReportRow, candidateRowTexts: string[]) => {
  if (candidateRowTexts.length === 0) return true;

  const aliases = getMarkerAliases(canonicalizeMarkerName(row.marker || ""));
  const matchingCandidates = candidateRowTexts.filter((candidate) => {
    const normalizedCandidate = normalizeForMatch(candidate);
    return aliases.some((alias) => normalizedCandidate.includes(alias));
  });

  if (matchingCandidates.length === 0) {
    return false;
  }

  const valueText = normalizeForMatch(row.value || "");
  const rangeNumbers = (row.referenceRange || "").match(/\d+(?:\.\d+)?/g) || [];
  const unitText = normalizeForMatch(row.unit || "");

  return matchingCandidates.some((candidate) => {
    const normalizedCandidate = normalizeForMatch(candidate);
    const hasValue = !valueText || normalizedCandidate.includes(valueText);
    const hasRange =
      !row.referenceRange ||
      rangeNumbers.length === 0 ||
      rangeNumbers.some((num) => normalizedCandidate.includes(num));
    const hasUnit = !unitText || normalizedCandidate.includes(unitText);
    return hasValue && (hasRange || hasUnit);
  });
};

const shouldKeepExtractedRow = (
  reportContent: unknown,
  row: ExtractedReportRow,
  candidateRowTexts: string[] = []
) => {
  if (reportContentHasVisualInput(reportContent)) {
    const canonicalMarker = canonicalizeMarkerName(row.marker || "");
    if (!canonicalMarker) {
      return false;
    }

    if (row.status === "comment") {
      return Boolean(row.note?.trim());
    }

    return Boolean(row.value?.trim() || row.referenceRange?.trim() || row.unit?.trim());
  }

  if (candidateRowTexts.length > 0) {
    return rowMatchesCandidateText(row, candidateRowTexts);
  }

  if (rowHasExplicitTextEvidence(reportContent, row)) {
    return true;
  }

  return false;
};

const normalizeSourceRowBands = (
  pages: Array<{ pageNumber?: number; rows?: Array<{ y: number; text: string; tokens?: SourceToken[] }> }>
): SourceRowBand[] =>
  pages.flatMap((page) =>
    (page.rows || [])
      .map((row) => ({
        pageNumber: page.pageNumber,
        y: row.y,
        text: row.text,
        tokens: row.tokens
      }))
      .filter((row) => Boolean(row.text?.trim()))
  );

const rowLooksLikeVisibleData = (text: string) => {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  if (TABLE_HEADER_PATTERN.test(normalized)) return false;
  if (PANEL_PATTERNS.some((pattern) => pattern.test(normalized))) return false;
  if (/^(final report|pathlab fb health screen|scan qr|visit us at|speed accuracy|this is a computer generated report)/i.test(normalized)) {
    return false;
  }
  if (COMMENT_ROW_PATTERN.test(normalized)) return true;
  if (REFERENCE_ONLY_PATTERN.test(normalized) && !/\d/.test(normalized)) return false;

  const hasMarkerLikeText = /^[a-z][a-z0-9\s()\/.+-]{1,40}/i.test(normalized);
  const hasNumericSignal = /\d/.test(normalized);
  return hasMarkerLikeText && hasNumericSignal;
};

const extractCandidateRowTexts = (rowBands: SourceRowBand[]) =>
  rowBands
    .map((row) => row.text.replace(/\s+/g, " ").trim())
    .filter((text) => rowLooksLikeVisibleData(text));

const buildRowCropBands = (rowBands: SourceRowBand[]) => {
  const relevantRows = rowBands
    .filter((row): row is SourceRowBand & { y: number } => typeof row.y === "number" && rowLooksLikeVisibleData(row.text))
    .sort((a, b) => a.y - b.y);

  if (relevantRows.length === 0) {
    return [];
  }

  const groups: Array<Array<SourceRowBand & { y: number }>> = [];
  for (let index = 0; index < relevantRows.length; index += 2) {
    groups.push(relevantRows.slice(index, index + 2));
  }

  const baseBands = groups.map((group, index) => {
    const first = group[0];
    const last = group[group.length - 1];
    const previous = groups[index - 1]?.[groups[index - 1].length - 1];
    const next = groups[index + 1]?.[0];

    const top = previous ? (previous.y + first.y) / 2 : first.y - 26;
    const bottom = next ? (last.y + next.y) / 2 : last.y + 40;
    return {
      top: Math.max(0, top),
      bottom: Math.max(top + 24, bottom)
    };
  });

  const differentialRows = relevantRows.filter((row) =>
    /differential count|neutrophil|lymphocyte|monocyte|eosinophil|basophil/i.test(row.text)
  );

  if (differentialRows.length > 0) {
    const first = differentialRows[0];
    const last = differentialRows[differentialRows.length - 1];
    baseBands.push({
      top: Math.max(0, first.y - 28),
      bottom: Math.max(first.y + 24, last.y + 36)
    });
  }

  return baseBands.sort((a, b) => a.top - b.top);
};

const buildRowCropImageParts = async (
  pages: Array<{ base64: string; mimeType: string; rowBands: SourceRowBand[] }>
) => {
  const parts: Array<{ type: "image_url"; image_url: { url: string; detail: "high" } }> = [];

  for (const page of pages) {
    const bands = buildRowCropBands(page.rowBands).slice(0, 24);
    if (bands.length === 0) {
      continue;
    }

    const crops = await cropImageBands(page.base64, page.mimeType, bands).catch(() => []);
    for (const crop of crops) {
      parts.push({
        type: "image_url",
        image_url: {
          url: `data:${crop.mimeType};base64,${crop.base64}`,
          detail: "high"
        }
      });
    }
  }

  return parts;
};

const isAsciiToken = (text: string) => /[A-Za-z0-9]/.test(text);

const findTableColumnAnchors = (tokens?: SourceToken[]): TableColumnAnchors | null => {
  if (!tokens || tokens.length === 0) return null;

  const lowered = tokens.map((token) => ({
    ...token,
    normalized: normalizeForMatch(token.text)
  }));

  const resultToken = lowered.find((token) => token.normalized === "result");
  const unitToken = lowered.find((token) => token.normalized === "unit");
  const rangeToken = lowered.find((token) => token.normalized === "reference range" || token.normalized === "reference");

  if (!resultToken || !unitToken || !rangeToken) {
    return null;
  }

  return {
    resultX: resultToken.x,
    unitX: unitToken.x,
    rangeX: rangeToken.x
  };
};

const buildSyntheticLineFromRowBand = (row: SourceRowBand, anchors: TableColumnAnchors) => {
  const tokens = (row.tokens || []).filter((token) => token.text.trim().length > 0);
  if (tokens.length === 0) {
    return row.text;
  }

  const markerTokens = tokens.filter((token) => token.x < anchors.resultX - 15 && isAsciiToken(token.text));
  const valueTokens = tokens.filter((token) => token.x >= anchors.resultX - 15 && token.x < anchors.unitX - 15);
  const unitTokens = tokens.filter((token) => token.x >= anchors.unitX - 15 && token.x < anchors.rangeX - 15);
  const rangeTokens = tokens.filter((token) => token.x >= anchors.rangeX - 15);

  const markerText = markerTokens.map((token) => token.text).join(" ").replace(/\s+/g, " ").trim();
  if (!markerText) {
    return row.text;
  }

  const valueText = valueTokens.map((token) => token.text).join(" ").replace(/\s+/g, " ").trim();
  const unitText = unitTokens.map((token) => token.text).join(" ").replace(/\s+/g, " ").trim();
  const rangeText = rangeTokens.map((token) => token.text).join(" ").replace(/\s+/g, " ").trim();

  return [markerText, valueText, unitText, rangeText].filter(Boolean).join(" ").trim();
};

const getDeterministicRowQuality = (row: ExtractedReportRow | null) => {
  if (!row) return -1;
  return (row.value ? 4 : 0) + (row.referenceRange ? 3 : 0) + (row.unit ? 2 : 0) + (row.note ? 1 : 0);
};

const chooseBestDeterministicRow = (
  rawLine: string,
  syntheticLine: string | null,
  panel?: string
): ExtractedReportRow | null => {
  const rawParsed = parseStructuredLineRow(rawLine, panel);
  const syntheticParsed = syntheticLine ? parseStructuredLineRow(syntheticLine, panel) : null;

  const rawScore = getDeterministicRowQuality(rawParsed);
  const syntheticScore = getDeterministicRowQuality(syntheticParsed);

  if (rawScore >= syntheticScore) {
    return rawParsed;
  }

  return syntheticParsed;
};

const getCanonicalMarkerId = (marker: string) => {
  const canonicalMarker = canonicalizeMarkerName(marker);
  return normalizeForMatch(canonicalMarker).replace(/\s+/g, "_");
};

const canonicalizeMarkerName = (marker: string) => {
  const normalized = normalizeForMatch(marker);
  const matchedDefinition = MARKER_DEFINITIONS.find((definition) =>
    getMarkerAliases(definition.marker).some((alias) => alias === normalized) ||
    definition.patterns.some((pattern) => pattern.test(marker))
  );

  if (matchedDefinition) {
    return matchedDefinition.marker;
  }

  if (/\bhaemoglobin\b/i.test(marker)) return "Hemoglobin";
  if (/^esr\b|erythrocyte sedimentation rate/i.test(marker)) return "ESR";
  if (/^rbc\b/i.test(marker)) return "RBC Count";
  if (/^hct\b|hematocrit|haematocrit/i.test(marker)) return "PCV (HCT)";
  if (/^hba1c\b|hb a1c|glycated hemoglobin/i.test(marker)) return "HbA1c";
  if (/^glucose\b|fasting glucose|blood glucose/i.test(marker)) return "Glucose";
  if (/^tlc\b|total leucocyte count|total leukocyte count/i.test(marker)) return "Total WBC Count";
  if (/absolute basophils/i.test(marker)) return "Absolute Basophil Count";

  return marker.trim();
};

const buildVerifiedConcern = (marker: VerifiedAbnormalMarker) => {
  const directionText =
    marker.abnormalDirection === "high"
      ? "Elevated"
      : marker.abnormalDirection === "low"
      ? "Low"
      : marker.abnormalDirection === "flagged"
      ? "Flagged"
      : "Abnormal";

  const valueText = marker.value ? ` at ${marker.value}` : "";
  const rangeText = marker.referenceRange ? ` (reference: ${marker.referenceRange})` : "";
  const noteText = marker.note ? ` ${marker.note}` : "";
  return `${directionText} ${marker.marker}${valueText}${rangeText}${noteText}`.trim();
};

const parseNumericValue = (value?: string) => {
  if (!value) return null;
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};

const parseReferenceRange = (referenceRange?: string) => {
  if (!referenceRange) return null;
  const normalized = referenceRange
    .replace(/,/g, "")
    .replace(/[??]/g, "-")
    .replace(/[＜﹤⟨〈]/g, "<")
    .replace(/[＞﹥⟩〉]/g, ">")
    .replace(/[≤]/g, "<=")
    .replace(/[≥]/g, ">=")
    .trim();
  const matches = normalized.match(/\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return null;

  const upperMatch = normalized.match(/^(?:<|<=)\s*(\d+(?:\.\d+)?)/);
  if (upperMatch) {
    const upper = Number(upperMatch[1]);
    return Number.isNaN(upper) ? null : { type: "upper" as const, upper };
  }

  const lowerMatch = normalized.match(/^(?:>|>=)\s*(\d+(?:\.\d+)?)/);
  if (lowerMatch) {
    const lower = Number(lowerMatch[1]);
    return Number.isNaN(lower) ? null : { type: "lower" as const, lower };
  }

  if (matches.length >= 2) {
    const min = Number(matches[0]);
    const max = Number(matches[1]);
    if (Number.isNaN(min) || Number.isNaN(max)) return null;
    return { type: "between" as const, min, max };
  }

  return null;
};

const inferRowStatus = (row: ExtractedReportRow): ExtractedReportRow["status"] => {
  if (row.status === "comment") return "comment";

  const numericValue = parseNumericValue(row.value);
  const numericRange = parseReferenceRange(row.referenceRange);
  if (numericValue !== null && numericRange) {
    if (numericRange.type === "between") {
      if (numericValue < numericRange.min) return "low";
      if (numericValue > numericRange.max) return "high";
      return "normal";
    }
    if (numericRange.type === "upper") {
      return numericValue <= numericRange.upper ? "normal" : "high";
    }
    if (numericRange.type === "lower") {
      return numericValue >= numericRange.lower ? "normal" : "low";
    }
  }

  // If a numeric value is present but no printable reference range is available,
  // treat as normal by default unless the source explicitly flagged it otherwise.
  if (
    numericValue !== null &&
    !numericRange &&
    row.status !== "high" &&
    row.status !== "low" &&
    row.status !== "abnormal" &&
    row.status !== "flagged"
  ) {
    return "normal";
  }

  return row.status;
};

const buildRowConcern = (row: ExtractedReportRow) => {
  const effectiveStatus = inferRowStatus(row);
  const statusText =
    effectiveStatus === "high"
      ? "is high"
      : effectiveStatus === "low"
      ? "is low"
      : effectiveStatus === "normal"
      ? "is within range"
      : effectiveStatus === "comment"
      ? "comment"
      : effectiveStatus === "flagged"
      ? "is flagged"
      : "is abnormal";

  const valueText = row.value ? ` at ${row.value}${row.unit ? ` ${row.unit}` : ""}` : "";
  const rangeText = row.referenceRange ? ` (reference range: ${row.referenceRange})` : "";
  const noteText = row.note ? ` ${row.note}` : "";

  if (effectiveStatus === "comment") {
    return `${row.marker}${row.note ? `: ${row.note}` : ""}`.trim();
  }

  return `${row.marker} ${statusText}${valueText}${rangeText}.${noteText}`.replace(/\.\s*\./g, ".").trim();
};

const buildParsedRowExplanation = (row: ParsedReportRow) => {
  if (row.explanation?.trim()) return row.explanation.trim();

  if (row.status === "high") {
    return "This marker is above the lab's stated range, so it may need follow-up in the context of your overall health picture.";
  }
  if (row.status === "low") {
    return "This marker is below the lab's stated range, so it may reflect an area worth monitoring more closely.";
  }
  if (row.status === "flagged" || row.status === "abnormal") {
    return "This result appears outside the expected pattern in the report and may need clinical interpretation alongside your symptoms and history.";
  }
  if (row.status === "normal") {
    return "This marker sits within the printed lab range on this report.";
  }
  if (row.status === "comment") {
    return "This note was included in the report comments and may add clinical context to the lab values.";
  }
  return "This row was extracted from the report but could not be fully classified from the printed range alone.";
};

const buildParsedRowConcern = (row: ParsedReportRow) =>
  `${row.marker} is ${row.status}${row.value ? ` at ${row.value}${row.unit ? ` ${row.unit}` : ""}` : ""}${row.referenceRange ? ` (reference range: ${row.referenceRange})` : ""}.`.replace(/\.\s*\./g, ".").trim();

const buildParsedRowStrength = (row: ParsedReportRow) =>
  `${row.marker} is within normal range${row.value ? ` at ${row.value}${row.unit ? ` ${row.unit}` : ""}` : ""}${row.referenceRange ? ` (reference range: ${row.referenceRange})` : ""}.`.replace(/\.\s*\./g, ".").trim();

const getStatusConsistencyScore = (value?: string, referenceRange?: string, status?: ParsedReportRow["status"]) => {
  const numericValue = parseNumericValue(value);
  const numericRange = parseReferenceRange(referenceRange);
  if (numericValue === null || !numericRange || !status || status === "unknown" || status === "comment") {
    return 0;
  }

  const inferredStatus = inferRowStatus({ marker: "", value, referenceRange, status });
  if (inferredStatus === status) return 2;
  if ((inferredStatus === "high" || inferredStatus === "low") && status === "normal") return -3;
  if (inferredStatus === "normal" && (status === "high" || status === "low" || status === "abnormal" || status === "flagged")) return -2;
  return -1;
};

const DIFFERENTIAL_MARKERS = [
  "Neutrophils",
  "Lymphocytes",
  "Monocytes",
  "Eosinophils",
  "Basophils"
] as const;

const DIFFERENTIAL_MARKER_SET = new Set(DIFFERENTIAL_MARKERS);

const getRowSourceScore = (source?: ParsedReportRow["source"]) =>
  source === "deterministic" ? 3 : source === "validated" ? 2 : source === "ai" ? 1 : 0;

const toParsedRow = (row: ExtractedReportRow): ParsedReportRow | null => {
  if (row.status === "comment") return null;

  const marker = canonicalizeMarkerName(row.marker || "");
  if (!marker) return null;

  return {
    markerId: getCanonicalMarkerId(marker),
    panel: row.panel?.trim() || undefined,
    marker,
    value: row.value?.trim() || undefined,
    unit: row.unit?.trim() || undefined,
    referenceRange: row.referenceRange?.trim() || undefined,
    status: inferRowStatus(row) || "unknown",
    note: row.note?.trim() || undefined,
    explanation: row.whyItMatters?.trim() || undefined,
    source: row.source
  };
};

const reconcileDifferentialRows = (
  rows: ParsedReportRow[],
  sourceRows: ExtractedReportRow[]
): ParsedReportRow[] => {
  const currentByMarker = new Map(rows.map((row) => [row.marker, row]));
  const missingMarkers = DIFFERENTIAL_MARKERS.filter((marker) => !currentByMarker.has(marker));
  if (missingMarkers.length > 0) {
    return rows;
  }

  const candidatesByMarker = new Map<typeof DIFFERENTIAL_MARKERS[number], ParsedReportRow[]>();
  for (const marker of DIFFERENTIAL_MARKERS) {
    candidatesByMarker.set(marker, []);
  }

  const addCandidate = (candidate: ParsedReportRow) => {
    if (!DIFFERENTIAL_MARKER_SET.has(candidate.marker as typeof DIFFERENTIAL_MARKERS[number])) return;
    const marker = candidate.marker as typeof DIFFERENTIAL_MARKERS[number];
    const numericValue = parseNumericValue(candidate.value);
    if (numericValue === null || numericValue < 0 || numericValue > 100) return;
    const list = candidatesByMarker.get(marker);
    if (!list) return;

    const duplicate = list.find((existing) => {
      const existingValue = parseNumericValue(existing.value);
      return existingValue !== null && Math.abs(existingValue - numericValue) < 0.0001;
    });

    if (!duplicate) {
      list.push(candidate);
      return;
    }

    const existingScore =
      getRowSourceScore(duplicate.source) +
      (duplicate.referenceRange ? 2 : 0) +
      (duplicate.unit ? 1 : 0) +
      getStatusConsistencyScore(duplicate.value, duplicate.referenceRange, duplicate.status);
    const incomingScore =
      getRowSourceScore(candidate.source) +
      (candidate.referenceRange ? 2 : 0) +
      (candidate.unit ? 1 : 0) +
      getStatusConsistencyScore(candidate.value, candidate.referenceRange, candidate.status);

    if (incomingScore > existingScore) {
      const index = list.indexOf(duplicate);
      list[index] = candidate;
    }
  };

  for (const sourceRow of sourceRows) {
    const parsed = toParsedRow(sourceRow);
    if (parsed) addCandidate(parsed);
  }

  for (const marker of DIFFERENTIAL_MARKERS) {
    const current = currentByMarker.get(marker);
    if (current) addCandidate(current);
  }

  const markersWithSparseCandidates = DIFFERENTIAL_MARKERS.filter((marker) => {
    const candidates = candidatesByMarker.get(marker) || [];
    return candidates.length <= 1;
  });

  if (markersWithSparseCandidates.length > 0) {
    return rows;
  }

  const candidateMatrix = DIFFERENTIAL_MARKERS.map((marker) =>
    (candidatesByMarker.get(marker) || [])
      .sort((a, b) => {
        const aScore =
          getRowSourceScore(a.source) +
          (a.referenceRange ? 2 : 0) +
          (a.unit ? 1 : 0) +
          getStatusConsistencyScore(a.value, a.referenceRange, a.status);
        const bScore =
          getRowSourceScore(b.source) +
          (b.referenceRange ? 2 : 0) +
          (b.unit ? 1 : 0) +
          getStatusConsistencyScore(b.value, b.referenceRange, b.status);
        return bScore - aScore;
      })
      .slice(0, 4)
  );

  let bestCombo: ParsedReportRow[] = [];
  let hasBestCombo = false;
  let bestScore = Number.NEGATIVE_INFINITY;

  const dfs = (index: number, acc: ParsedReportRow[]) => {
    if (index >= candidateMatrix.length) {
      const values = acc.map((row) => parseNumericValue(row.value)).filter((value): value is number => value !== null);
      if (values.length !== DIFFERENTIAL_MARKERS.length) return;
      const sum = values.reduce((total, value) => total + value, 0);

      const consistency = acc.reduce(
        (total, row) => total + getStatusConsistencyScore(row.value, row.referenceRange, row.status),
        0
      );
      const quality = acc.reduce(
        (total, row) =>
          total +
          getRowSourceScore(row.source) +
          (row.referenceRange ? 2 : 0) +
          (row.unit ? 1 : 0),
        0
      );

      const score = quality + consistency * 2 - Math.abs(sum - 100) * 6;
      if (score > bestScore) {
        bestScore = score;
        hasBestCombo = true;
        bestCombo = [...acc];
      }
      return;
    }

    for (const candidate of candidateMatrix[index]) {
      acc.push(candidate);
      dfs(index + 1, acc);
      acc.pop();
    }
  };

  dfs(0, []);

  if (!hasBestCombo || bestCombo.length === 0) {
    return rows;
  }

  const bestByMarker = new Map(bestCombo.map((row) => [row.marker, row]));
  return rows.map((row) => bestByMarker.get(row.marker) || row);
};

const finalizeParsedRows = (rows: ExtractedReportRow[]): ParsedReportRow[] => {
  const deduped = new Map<string, ParsedReportRow>();
  const sourceRows = [...rows];

  for (const row of sourceRows) {
    if (row.status === "comment") {
      continue;
    }

    const parsedRow = toParsedRow(row);
    if (!parsedRow) continue;

    const key = [
      parsedRow.markerId,
      parsedRow.status === "comment" ? parsedRow.note || "" : ""
    ].join("|");

    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, parsedRow);
      continue;
    }

    const existingHasLockedDeterministicValue =
      existing.source === "deterministic" && Boolean(existing.value || existing.referenceRange || existing.unit);
    const incomingIsNonDeterministic = row.source !== "deterministic";
    if (existingHasLockedDeterministicValue && incomingIsNonDeterministic) {
      deduped.set(key, {
        ...existing,
        note: existing.note || parsedRow.note,
        explanation: existing.explanation || parsedRow.explanation
      });
      continue;
    }

    const existingScore =
      (existing.source === "deterministic" ? 12 : existing.source === "validated" ? 8 : 0) +
      (existing.value ? 4 : 0) +
      (existing.referenceRange ? 3 : 0) +
      (existing.status !== "unknown" ? 2 : 0) +
      (existing.note ? 1 : 0) +
      getStatusConsistencyScore(existing.value, existing.referenceRange, existing.status);
    const parsedScore =
      (row.source === "deterministic" ? 12 : row.source === "validated" ? 8 : 0) +
      (parsedRow.value ? 4 : 0) +
      (parsedRow.referenceRange ? 3 : 0) +
      (parsedRow.status !== "unknown" ? 2 : 0) +
      (parsedRow.note ? 1 : 0) +
      getStatusConsistencyScore(parsedRow.value, parsedRow.referenceRange, parsedRow.status);

    if (parsedScore > existingScore) {
      deduped.set(key, parsedRow);
      continue;
    }

    if ((!existing.note && parsedRow.note) || (!existing.explanation && parsedRow.explanation)) {
      deduped.set(key, {
        ...existing,
        note: existing.note || parsedRow.note,
        explanation: existing.explanation || parsedRow.explanation
      });
    }
  }

  const reconciledRows = reconcileDifferentialRows([...deduped.values()], sourceRows);
  return reconciledRows;
};

const enforceDifferentialLabelStrictness = (
  rows: ExtractedReportRow[],
  candidateRowTexts: string[]
): ExtractedReportRow[] => {
  const normalizedCandidates = candidateRowTexts.map((text) => normalizeForMatch(text));
  const hasPolymorphLabel = normalizedCandidates.some((line) => /\bpolymorphs?\b/.test(line));
  const hasNeutrophilLabel = normalizedCandidates.some((line) => /\bneutrophils?\b/.test(line));

  // Keep labels exactly as printed in report candidates.
  // If report shows only Polymorphs, do not add Neutrophils.
  if (hasPolymorphLabel && !hasNeutrophilLabel) {
    return rows.filter((row) => canonicalizeMarkerName(row.marker || "") !== "Neutrophils");
  }

  // If report shows only Neutrophils, do not add Polymorphs.
  if (hasNeutrophilLabel && !hasPolymorphLabel) {
    return rows.filter((row) => canonicalizeMarkerName(row.marker || "") !== "Polymorphs");
  }

  // If both are explicitly present, keep both.
  return rows;
};

const buildDeterministicFindings = (rows: ParsedReportRow[]) => {
  const concerns: string[] = [];
  const strengths: string[] = [];
  const detailedInsights: BloodworkAnalysis["detailedInsights"] = [];

  for (const row of rows) {
    if (concernStatusSet.has(row.status)) {
      const concern = buildParsedRowConcern(row);
      concerns.push(concern);
      detailedInsights.push({
        category: row.panel || "Parsed marker",
        findings: concern,
        impact: buildParsedRowExplanation(row)
      });
      continue;
    }

    if (row.status === "normal" && row.value && row.referenceRange) {
      strengths.push(buildParsedRowStrength(row));
    }
  }

  return {
    concerns,
    strengths: strengths.slice(0, 8),
    detailedInsights: detailedInsights.slice(0, 10)
  };
};

const textMentionsMarker = (text: string, marker: string) => {
  const normalizedText = normalizeForMatch(text);
  const aliases = getMarkerAliases(marker);
  return aliases.some((alias) => normalizedText.includes(alias));
};

const parseStructuredLineRow = (line: string, panel?: string): ExtractedReportRow | null => {
  const trimmed = line.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;

  const commentMatch = trimmed.match(COMMENT_ROW_PATTERN);
  if (commentMatch) {
    return {
      panel,
      marker: commentMatch[1],
      note: commentMatch[2] || undefined,
      status: "comment",
      whyItMatters: commentMatch[2] ? "This report note may add context to the laboratory findings." : undefined
    };
  }

  const markerDefinition = MARKER_DEFINITIONS.find((definition) =>
    definition.patterns.some((pattern) => pattern.test(trimmed))
  );
  if (!markerDefinition) return null;

  const matchedPattern = markerDefinition.patterns.find((pattern) => pattern.test(trimmed));
  const markerMatch = matchedPattern ? trimmed.match(matchedPattern) : null;
  if (!markerMatch) return null;

  let remainder = trimmed.slice(markerMatch[0].length).trim();
  remainder = remainder.replace(/^[\:\-]+/, "").trim();

  const rangeMatch = remainder.match(/((?:<|<=|>|>=)\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?)\s*$/);
  const referenceRange = rangeMatch ? rangeMatch[1].replace(/\s+/g, " ").trim() : undefined;
  if (referenceRange && typeof rangeMatch?.index === "number") {
    remainder = remainder.slice(0, rangeMatch.index).trim();
  }

  const unitMatch = remainder.match(/([A-Za-z%][A-Za-z0-9\/.%]*)\s*$/);
  const unit = unitMatch ? unitMatch[1].trim() : undefined;
  if (unit && typeof unitMatch?.index === "number") {
    remainder = remainder.slice(0, unitMatch.index).trim();
  }

  const valueMatch = remainder.match(/(?:\b([HL])\b\s*)?(\d+(?:\.\d+)?)\s*$/i);
  const value = valueMatch ? valueMatch[2] : undefined;
  const note = valueMatch?.[1] ? `Flag ${valueMatch[1].toUpperCase()} shown in report.` : undefined;

  if (!value && !referenceRange) {
    return null;
  }

  return {
    panel,
    marker: markerDefinition.marker,
    value,
    unit,
    referenceRange,
    status: valueMatch?.[1]?.toUpperCase() === "H" ? "high" : valueMatch?.[1]?.toUpperCase() === "L" ? "low" : "unknown",
    note,
    whyItMatters: undefined,
    source: "deterministic"
  };
};

const parseStructuredTextLines = (lines: string[]): ExtractedReportRow[] =>
  parseStructuredRowBands(lines.map((line) => ({ text: line }))).rows;

const parseStructuredRowBands = (
  rowBands: SourceRowBand[]
): {
  rows: ExtractedReportRow[];
  candidateRowTexts: string[];
  panelCounts: Record<string, number>;
} => {
  const rows: ExtractedReportRow[] = [];
  const candidateRowTexts: string[] = [];
  const panelCounts: Record<string, number> = {};
  let currentPanel: string | undefined;
  let currentAnchors: TableColumnAnchors | null = null;

  for (const band of rowBands) {
    const line = band.text.trim();
    if (!line) continue;

    const detectedAnchors = findTableColumnAnchors(band.tokens);
    if (detectedAnchors) {
      currentAnchors = detectedAnchors;
      continue;
    }

    if (PANEL_PATTERNS.some((pattern) => pattern.test(line))) {
      currentPanel = line;
      panelCounts[currentPanel] = panelCounts[currentPanel] || 0;
      continue;
    }

    if (TABLE_HEADER_PATTERN.test(line)) {
      continue;
    }

    if (rowLooksLikeVisibleData(line)) {
      candidateRowTexts.push(line);
      if (currentPanel) {
        panelCounts[currentPanel] = (panelCounts[currentPanel] || 0) + 1;
      }
    }

    const shouldUseSyntheticLine = Boolean(currentAnchors) && !/differential count/i.test(currentPanel || "");
    const syntheticLine = shouldUseSyntheticLine && currentAnchors
      ? buildSyntheticLineFromRowBand(band, currentAnchors)
      : null;
    const parsed = chooseBestDeterministicRow(line, syntheticLine, currentPanel);
    if (parsed) {
      rows.push(parsed);
    }
  }

  return { rows, candidateRowTexts, panelCounts };
};

const deriveRowsFromCandidateTexts = (candidateRowTexts: string[]): ExtractedReportRow[] => {
  return candidateRowTexts
    .map((text) => parseStructuredLineRow(text))
    .filter((row): row is ExtractedReportRow => Boolean(row))
    .map((row) => ({
      ...row,
      source: "deterministic" as const,
      note: row.note
        ? `${row.note} Derived from candidate row text.`
        : "Derived from candidate row text."
    }));
};

const mergeWithCandidateDerivedRows = (
  rows: ExtractedReportRow[],
  candidateRowTexts: string[]
): ExtractedReportRow[] => {
  const derivedRows = deriveRowsFromCandidateTexts(candidateRowTexts);
  if (derivedRows.length === 0) {
    return rows;
  }

  return [...rows, ...derivedRows];
};

const parseStructuredPdfRows = (
  pages: Array<{ pageNumber?: number; text: string; rows?: Array<{ y: number; text: string; tokens?: SourceToken[] }> }>
) => {
  const rowBands = normalizeSourceRowBands(pages);
  if (rowBands.length > 0) {
    return parseStructuredRowBands(rowBands);
  }

  const fallbackBands = pages.flatMap((page) =>
    page.text
      .split(/\r?\n/)
      .map((line) => ({ pageNumber: page.pageNumber, text: line.trim() }))
      .filter((row) => Boolean(row.text))
  );
  return parseStructuredRowBands(fallbackBands);
};

const extractImageOcrBundle = async (
  images: { base64: string; fileType: string; label: string }[]
) => {
  const blocks: string[] = [];
  const rowBands: SourceRowBand[] = [];
  const candidateRowTexts: string[] = [];
  const panelCounts: Record<string, number> = {};
  const rows: ExtractedReportRow[] = [];

  for (const [index, image] of images.entries()) {
    try {
      const ocr = await extractStructuredTextFromImage(
        image.base64,
        normalizeImageMimeType(image.fileType)
      );
      if (ocr.text) {
        blocks.push(`Document: ${image.label}\nType: Image health report\nOCR text:\n${ocr.text}`);
      }
      const pageBands =
        ocr.rows.length > 0
          ? ocr.rows.map((row) => ({
              pageNumber: index + 1,
              y: row.y,
              text: row.text,
              tokens: row.tokens
            }))
          : ocr.lines.map((line) => ({ pageNumber: index + 1, text: line }));
      rowBands.push(...pageBands);
    } catch (error) {
      console.warn("Image OCR failed:", image.label, error);
    }
  }

  const parsed = parseStructuredRowBands(rowBands);
  rows.push(...parsed.rows);
  parsed.candidateRowTexts.forEach((text) => candidateRowTexts.push(text));
  Object.entries(parsed.panelCounts).forEach(([panel, count]) => {
    panelCounts[panel] = (panelCounts[panel] || 0) + count;
  });

  return { blocks, rows, rowBands, candidateRowTexts, panelCounts };
};

const computeExtractionCompleteness = (
  rows: ExtractedReportRow[],
  candidateRowTexts: string[],
  panelCounts: Record<string, number>
): { level: BloodworkAnalysis["extractionCompleteness"]; missingVisibleRowsCount: number } => {
  const finalRowCount = finalizeParsedRows(rows).length;
  const candidateCount = candidateRowTexts.length;
  const missingVisibleRowsCount = Math.max(0, candidateCount - finalRowCount);
  const hasThinPanel = Object.values(panelCounts).some((count) => count >= 4 && count - finalRowCount >= 3);

  if (candidateCount === 0) {
    return { level: "low-confidence", missingVisibleRowsCount: 0 };
  }

  const coverage = finalRowCount / candidateCount;
  if (!hasThinPanel && coverage >= 0.85) {
    return { level: "complete", missingVisibleRowsCount };
  }
  if (coverage >= 0.55) {
    return { level: "partial", missingVisibleRowsCount };
  }
  return { level: "low-confidence", missingVisibleRowsCount };
};

const mergeAnalysisWithParsedRows = (
  analysis: BloodworkAnalysis,
  rows: ExtractedReportRow[],
  diagnostics?: { candidateRowTexts?: string[]; panelCounts?: Record<string, number> }
): BloodworkAnalysis => {
  const candidateRowTexts = diagnostics?.candidateRowTexts || [];
  const mergedRows = mergeWithCandidateDerivedRows(rows, candidateRowTexts);
  const parsedRows = finalizeParsedRows(mergedRows);
  const completeness = computeExtractionCompleteness(
    mergedRows,
    candidateRowTexts,
    diagnostics?.panelCounts || {}
  );
  if (parsedRows.length === 0) {
    return {
      ...analysis,
      extractionCompleteness: completeness.level,
      missingVisibleRowsCount: completeness.missingVisibleRowsCount,
      parsingDebug: {
        rawRowCount: mergedRows.length,
        finalRowCount: 0,
        candidateRowCount: diagnostics?.candidateRowTexts?.length || 0,
        panelCounts: diagnostics?.panelCounts || {}
      }
    };
  }

  const deterministic = buildDeterministicFindings(parsedRows);

  return {
    ...analysis,
    concerns: deterministic.concerns,
    strengths: deterministic.strengths.slice(0, 8),
    detailedInsights: deterministic.detailedInsights,
    parsedRows,
    extractionCompleteness: completeness.level,
    missingVisibleRowsCount: completeness.missingVisibleRowsCount,
    parsingDebug: {
      rawRowCount: mergedRows.length,
      finalRowCount: parsedRows.length,
      candidateRowCount: diagnostics?.candidateRowTexts?.length || 0,
      panelCounts: diagnostics?.panelCounts || {},
      derivedMarkerIds: parsedRows
        .filter((row) => row.note?.includes("Derived from"))
        .map((row) => row.markerId)
    }
  };
};

const mergeVerifiedAbnormalMarkers = (
  analysis: BloodworkAnalysis,
  markers: VerifiedAbnormalMarker[]
): BloodworkAnalysis => {
  if (markers.length === 0) return analysis;

  const existingConcernText = new Set(
    (analysis.concerns || []).map((item) => normalizeForMatch(item))
  );
  const existingInsightText = normalizeForMatch(
    (analysis.detailedInsights || [])
      .flatMap((item) => [item.category, item.findings, item.impact])
      .join(" ")
  );

  const appendedConcerns: string[] = [];
  const appendedInsightLines: string[] = [];

  for (const marker of markers) {
    const markerKey = normalizeForMatch(marker.marker);
    const concernLine = buildVerifiedConcern(marker);
    const concernKey = normalizeForMatch(concernLine);

    const alreadyCovered =
      [...existingConcernText].some((item) => item.includes(markerKey) || markerKey.includes(item)) ||
      existingInsightText.includes(markerKey);

    if (!alreadyCovered && !existingConcernText.has(concernKey)) {
      existingConcernText.add(concernKey);
      appendedConcerns.push(concernLine);
      appendedInsightLines.push(
        `${marker.panel ? `${marker.panel}: ` : ""}${marker.marker}${marker.value ? ` ${marker.value}` : ""}${marker.referenceRange ? ` (reference ${marker.referenceRange})` : ""}`
      );
    }
  }

  if (appendedConcerns.length === 0) {
    return analysis;
  }

  return {
    ...analysis,
    concerns: [...analysis.concerns, ...appendedConcerns],
    detailedInsights: [
      ...analysis.detailedInsights,
      {
        category: "Additional abnormal markers",
        findings: appendedInsightLines.join("; "),
        impact: "Added by verification pass to ensure less-prominent out-of-range markers are not omitted."
      }
    ]
  };
};

const verifyAbnormalMarkersCoverage = async (
  reportContent: unknown,
  language: Language
): Promise<VerifiedAbnormalMarker[]> => {
  const response = await createChatCompletion({
    model: ANALYSIS_MODEL,
    messages: [
      {
        role: "system",
        content:
          `You are a bloodwork verification engine. Your only job is to find every abnormal, flagged, out-of-range, starred, H/L, or otherwise non-normal marker in the provided report. ${getLanguageInstruction(language)} Return valid JSON only.`
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Review the full report exhaustively.

${BLOODWORK_EXTRACTION_RULES}

Return JSON with this exact shape:
{
  "abnormalMarkers": [
    {
      "panel": "panel name if known",
      "marker": "marker name",
      "value": "reported value",
      "referenceRange": "printed reference range if visible",
      "abnormalDirection": "high|low|abnormal|flagged",
      "note": "short note if range is partially obscured or marker is visually flagged"
    }
  ]
}

Rules:
- Include every abnormal or flagged marker you can find.
- Do not include normal markers.
- If the same marker appears twice, keep the clearest entry.
- If range visibility is partial, still include the marker.`
          },
          ...(Array.isArray(reportContent) ? reportContent : [reportContent])
        ]
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0
  });

  const content = response.choices[0].message.content;
  if (!content) return [];

  const parsed = JSON.parse(content) as { abnormalMarkers?: VerifiedAbnormalMarker[] };
  return (parsed.abnormalMarkers || []).filter((marker) => typeof marker?.marker === "string" && marker.marker.trim().length > 0);
};

const extractStructuredReportRows = async (
  reportContent: unknown,
  language: Language,
  candidateRowTexts: string[] = []
): Promise<ExtractedReportRow[]> => {
  const extractionContent = reportContentHasVisualInput(reportContent)
    ? getVisualOnlyReportContent(reportContent)
    : reportContent;
  const response = await createChatCompletion({
    model: ANALYSIS_MODEL,
    messages: [
      {
        role: "system",
        content:
          `You are an exhaustive clinical report extraction engine. Your only job is to read every visible line in the provided report and return structured rows. ${getLanguageInstruction(language)} Return valid JSON only.`
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Read every visible line in the uploaded report.

You must extract:
- every biomarker/test row with a value if visible
- the printed reference range if visible
- whether the row appears high, low, normal, abnormal, flagged, or is a clinician/report comment
- report comments such as "relative lymphocytosis seen", "platelets adequate", or similar

Important rules:
- Be exhaustive. Do not skip indices, differential counts, percentages, comments, or less prominent rows.
- If a value is bolded, starred, flagged, H/L, or outside the shown range, mark status accordingly.
- If a report comment indicates an abnormal pattern, include it as status "comment".
- Keep each row short and structured.
- If something is partially unreadable, still include the row and mention that in note.
- Never attach a value, unit, or reference range from a neighboring row to a different marker.
- For image/PDF reports, read directly from the visible table rows in the uploaded image, not from inferred OCR fragments.
- If the marker label is visible but the value is ambiguous, leave the value blank instead of guessing.
- Do not summarize. Extract rows only.

Return JSON with this exact shape:
{
  "rows": [
    {
      "panel": "panel name if known",
      "marker": "marker/test/comment label",
      "value": "observed value if any",
      "unit": "unit if any",
      "referenceRange": "printed range if any",
      "status": "high|low|normal|abnormal|flagged|comment",
      "note": "short extraction note if needed",
      "whyItMatters": "one short plain-language explanation of why this matters"
    }
  ]
}`
          },
          ...(Array.isArray(reportContent) ? reportContent : [reportContent])
        ]
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0
  });

  const content = response.choices[0].message.content;
  if (!content) return [];

  const parsed = JSON.parse(content) as { rows?: ExtractedReportRow[] };
  return (parsed.rows || []).filter(
    (row) =>
      typeof row?.marker === "string" &&
      row.marker.trim().length > 0 &&
      shouldKeepExtractedRow(reportContent, row, candidateRowTexts)
  ).map((row) => ({ ...row, source: "ai" as const }));
};

const extractVisibleBloodworkRowsFromVisualReport = async (
  reportContent: unknown,
  language: Language
): Promise<ExtractedReportRow[]> => {
  const extractionContent = getVisualOnlyReportContent(reportContent);
  const response = await createChatCompletion({
    model: ANALYSIS_MODEL,
    messages: [
      {
        role: "system",
        content:
          `You are a bloodwork table transcription engine. Your only job is to read the uploaded report images exactly as printed and return the visible bloodwork rows in table order. ${getLanguageInstruction(language)} Return valid JSON only.`
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Read the uploaded bloodwork report images carefully.

Return every visible bloodwork table row in the order it appears on the report.

Rules:
- Use only what is visibly printed in the report image.
- The first full-page image is the original source of truth; enhanced images/crops are only for readability support.
- If original and enhanced views conflict, prefer the original full-page digit.
- Transcribe exact printed values, units, and reference ranges.
- Do not summarize.
- Do not infer hidden or partially missing digits.
- Never copy a value from a neighboring row.
- Never use interpretation notes, diagnosis thresholds, or comment blocks as biomarker rows.
- If a marker name is visible but its value is unclear, leave value blank.
- It is acceptable for "status" to be "unknown" if no explicit flag is printed.
- Do not include report comments like "platelets appear adequate" as numeric biomarker rows.

Return JSON with this exact shape:
{
  "rows": [
    {
      "panel": "panel name if visible",
      "marker": "printed marker name",
      "value": "exact printed value if visible",
      "unit": "exact printed unit if visible",
      "referenceRange": "exact printed reference range if visible",
      "status": "high|low|normal|abnormal|flagged|comment|unknown",
      "note": "optional short note only if something is partially unreadable"
    }
  ]
}`
          },
          ...(Array.isArray(extractionContent) ? extractionContent : [extractionContent])
        ]
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 4200
  });

  const content = response.choices[0].message.content;
  if (!content) return [];

  const parsed = JSON.parse(content) as { rows?: ExtractedReportRow[] };
  return (parsed.rows || [])
    .filter((row) => typeof row?.marker === "string" && row.marker.trim().length > 0 && shouldKeepExtractedRow(reportContent, row))
    .map((row) => ({ ...row, source: "ai" as const }));
};

const verifyVisibleBloodworkRowsFromVisualReport = async (
  reportContent: unknown,
  language: Language,
  rows: ExtractedReportRow[]
): Promise<ExtractedReportRow[]> => {
  const extractionContent = getVisualOnlyReportContent(reportContent);
  const rowList = rows
    .filter((row) => row.marker?.trim())
    .map(
      (row, index) =>
        `${index + 1}. panel=${row.panel || ""} | marker=${row.marker} | value=${row.value || ""} | unit=${row.unit || ""} | range=${row.referenceRange || ""}`
    )
    .join("\n");

  if (!rowList) {
    return [];
  }

  const response = await createChatCompletion({
    model: ANALYSIS_MODEL,
    messages: [
      {
        role: "system",
        content:
          `You are a bloodwork row verification engine. Your only job is to compare extracted bloodwork rows against the uploaded report images and correct any mismatched digits, units, or ranges. ${getLanguageInstruction(language)} Return valid JSON only.`
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Verify these extracted bloodwork rows against the uploaded report images:
${rowList}

Rules:
- Re-check every row directly against the visible report image.
- The first full-page image is the original source of truth; enhanced images/crops are only for readability support.
- If original and enhanced views conflict, prefer the original full-page digit.
- Correct any wrong value, unit, or reference range.
- Keep only rows that are visibly present.
- Never move a number from one row to another.
- Never use diagnosis thresholds or comment sections as biomarker rows.
- If a value cannot be confirmed, leave it blank instead of guessing.
- Return the final corrected row list in report order.

Return JSON with this exact shape:
{
  "rows": [
    {
      "panel": "panel name if visible",
      "marker": "printed marker name",
      "value": "corrected exact value if visible",
      "unit": "corrected exact unit if visible",
      "referenceRange": "corrected exact range if visible",
      "status": "high|low|normal|abnormal|flagged|comment|unknown",
      "note": "optional short note only if something remains partially unreadable"
    }
  ]
}`
          },
          ...(Array.isArray(extractionContent) ? extractionContent : [extractionContent])
        ]
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 4200
  });

  const content = response.choices[0].message.content;
  if (!content) return [];

  const parsed = JSON.parse(content) as { rows?: ExtractedReportRow[] };
  return (parsed.rows || [])
    .filter((row) => typeof row?.marker === "string" && row.marker.trim().length > 0 && shouldKeepExtractedRow(reportContent, row))
    .map((row) => ({ ...row, source: "validated" as const }));
};

const extractDifferentialCountRowsFromVisualReport = async (
  reportContent: unknown,
  language: Language
): Promise<ExtractedReportRow[]> => {
  const extractionContent = getPrimaryVisualReportContent(reportContent, 8);
  const response = await createChatCompletion({
    model: ANALYSIS_MODEL,
    messages: [
      {
        role: "system",
        content:
          `You are a differential blood count transcription engine. Your only job is to read the report image and extract exact values for the printed differential markers: Neutrophils (or Polymorphs if that is the printed label), Lymphocytes, Monocytes, Eosinophils, and Basophils. ${getLanguageInstruction(language)} Return valid JSON only.`
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Extract only these differential markers from the DIFFERENTIAL COUNT section:
- Neutrophils (or Polymorphs if printed)
- Lymphocytes
- Monocytes
- Eosinophils
- Basophils

Rules:
- Use only visible printed digits.
- Use full-page original image digits as the source of truth; do not trust zoom crops if they conflict.
- Do not borrow values from neighboring rows.
- If uncertain, leave value blank rather than guessing.
- Keep marker names exactly as printed where possible.

Return JSON with this exact shape:
{
  "rows": [
    {
      "panel": "Differential count",
      "marker": "marker name",
      "value": "exact printed value if visible",
      "unit": "%",
      "referenceRange": "printed range if visible",
      "status": "high|low|normal|abnormal|flagged|unknown",
      "note": "optional"
    }
  ]
}`
          },
          ...(Array.isArray(extractionContent) ? extractionContent : [extractionContent])
        ]
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 1200
  });

  const content = response.choices[0].message.content;
  if (!content) return [];

  const parsed = JSON.parse(content) as { rows?: ExtractedReportRow[] };
  return (parsed.rows || [])
    .filter(
      (row) =>
        typeof row?.marker === "string" &&
        row.marker.trim().length > 0 &&
        /neutrophil|polymorph|lymphocyte|monocyte|eosinophil|basophil/i.test(row.marker) &&
        shouldKeepExtractedRow(reportContent, row)
    )
    .map((row) => ({ ...row, source: "ai" as const }));
};

const extractExpectedMarkers = async (
  reportContent: unknown,
  language: Language,
  expectedMarkers: readonly string[]
): Promise<ExtractedReportRow[]> => {
  const extractionContent = reportContentHasVisualInput(reportContent)
    ? getVisualOnlyReportContent(reportContent)
    : reportContent;
  const response = await createChatCompletion({
    model: ANALYSIS_MODEL,
    messages: [
      {
        role: "system",
        content:
          `You are a targeted clinical row extractor. Find only the requested markers if they appear in the uploaded report. ${getLanguageInstruction(language)} Return valid JSON only.`
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Search the report for these exact or near-exact markers and extract them if present:
${expectedMarkers.map((marker) => `- ${marker}`).join("\n")}

Rules:
- Return only rows for requested markers that are actually visible in the report.
- Keep the printed value, unit, and reference range if visible.
- If the marker is not present, do not invent it.
- Never borrow a value, unit, or reference range from an adjacent marker row.
- If the marker name is visible but the value is ambiguous, return the marker without a value instead of guessing.
- Preserve markers like "Non HDL", "A/G ratio", "ALT (SGPT)", and "AST (SGOT)" exactly when possible.

Return JSON with this exact shape:
{
  "rows": [
    {
      "panel": "panel name if known",
      "marker": "marker/test label",
      "value": "observed value if any",
      "unit": "unit if any",
      "referenceRange": "printed range if any",
      "status": "high|low|normal|abnormal|flagged|comment|unknown",
      "note": "short extraction note if needed",
      "whyItMatters": "one short plain-language explanation of why this matters"
    }
  ]
}`
          },
          ...(Array.isArray(extractionContent) ? extractionContent : [extractionContent])
        ]
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 3500
  });

  const content = response.choices[0].message.content;
  if (!content) return [];

  const parsed = JSON.parse(content) as { rows?: ExtractedReportRow[] };
  return (parsed.rows || []).filter(
    (row) =>
      typeof row?.marker === "string" &&
      row.marker.trim().length > 0 &&
      shouldKeepExtractedRow(reportContent, row)
  ).map((row) => ({ ...row, source: "ai" as const }));
};

const extractStructuredReportRowsRetry = async (
  reportContent: unknown,
  language: Language,
  candidateRowTexts: string[],
  parsedRows: ExtractedReportRow[]
): Promise<ExtractedReportRow[]> => {
  const extractionContent = reportContentHasVisualInput(reportContent)
    ? getVisualOnlyReportContent(reportContent)
    : reportContent;
  const extractedMarkerKeys = new Set(parsedRows.map((row) => normalizeForMatch(canonicalizeMarkerName(row.marker))));
  const likelyMissingRows = candidateRowTexts.filter((rowText) => {
    const normalized = normalizeForMatch(rowText);
    return ![...extractedMarkerKeys].some((key) => normalized.includes(key));
  });

  if (likelyMissingRows.length === 0) {
    return [];
  }

  const response = await createChatCompletion({
    model: ANALYSIS_MODEL,
    messages: [
      {
        role: "system",
        content:
          `You are a clinical table recovery engine. Your only job is to recover visible bloodwork rows that were likely missed in the first extraction pass. ${getLanguageInstruction(language)} Return valid JSON only.`
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `These candidate rows were visible in the report but were likely missed by the first extraction pass:
${likelyMissingRows.map((row, index) => `${index + 1}. ${row}`).join("\n")}

Rules:
- Recover only rows that are visibly present in the report.
- Keep output in report order where possible.
- It is acceptable to return a row with a marker and value but no reference range if the range is not visible.
- Do not invent missing markers that are not visibly present.
- Never assign a value from one row to a different marker.
- For image/PDF reports, use the visible row in the image as the source of truth.

Return JSON with this exact shape:
{
  "rows": [
    {
      "panel": "panel name if known",
      "marker": "marker/test label",
      "value": "observed value if any",
      "unit": "unit if any",
      "referenceRange": "printed range if any",
      "status": "high|low|normal|abnormal|flagged|comment|unknown",
      "note": "short extraction note if needed",
      "whyItMatters": "one short plain-language explanation of why this matters"
    }
  ]
}`
          },
          ...(Array.isArray(extractionContent) ? extractionContent : [extractionContent])
        ]
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 2200
  });

  const content = response.choices[0].message.content;
  if (!content) return [];

  const parsed = JSON.parse(content) as { rows?: ExtractedReportRow[] };
  return (parsed.rows || []).filter(
    (row) =>
      typeof row?.marker === "string" &&
      row.marker.trim().length > 0 &&
      shouldKeepExtractedRow(reportContent, row, candidateRowTexts)
  ).map((row) => ({ ...row, source: "ai" as const }));
};

const validateExtractedRowsAgainstReport = async (
  reportContent: unknown,
  language: Language,
  rows: ExtractedReportRow[],
  candidateRowTexts: string[]
): Promise<ExtractedReportRow[]> => {
  const extractionContent = reportContentHasVisualInput(reportContent)
    ? getVisualOnlyReportContent(reportContent)
    : reportContent;
  const rowList = rows
    .filter((row) => row.marker?.trim())
    .map(
      (row, index) =>
        `${index + 1}. ${row.marker} | value=${row.value || ""} | unit=${row.unit || ""} | range=${row.referenceRange || ""}`
    )
    .join("\n");

  if (!rowList) {
    return [];
  }

  const response = await createChatCompletion({
    model: ANALYSIS_MODEL,
    messages: [
      {
        role: "system",
        content:
          `You are a clinical row validation engine. Your only job is to compare extracted bloodwork rows against the actual uploaded report and correct any wrong values, units, or ranges. ${getLanguageInstruction(language)} Return valid JSON only.`
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Validate these extracted rows against the actual report:
${rowList}

Rules:
- Keep only rows that are visibly present in the report.
- Correct any extracted value, unit, or range that does not match the report.
- Never use a number from a different row or a diagnostic note block.
- For image/PDF reports, validate directly against the visible table rows in the uploaded image.
- If you cannot confidently verify a value for a marker, omit that corrected row rather than guessing.
- Do not invent new markers that were not already in the extracted list.

Return JSON with this exact shape:
{
  "rows": [
    {
      "panel": "panel name if known",
      "marker": "marker/test label",
      "value": "corrected value if visible",
      "unit": "corrected unit if visible",
      "referenceRange": "corrected range if visible",
      "status": "high|low|normal|abnormal|flagged|comment|unknown",
      "note": "short validation note if needed",
      "whyItMatters": "one short plain-language explanation of why this matters"
    }
  ]
}`
          },
          ...(Array.isArray(extractionContent) ? extractionContent : [extractionContent])
        ]
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 2600
  });

  const content = response.choices[0].message.content;
  if (!content) return [];

  const parsed = JSON.parse(content) as { rows?: ExtractedReportRow[] };
  return (parsed.rows || []).filter(
    (row) =>
      typeof row?.marker === "string" &&
      row.marker.trim().length > 0 &&
      shouldKeepExtractedRow(reportContent, row, candidateRowTexts)
  ).map((row) => ({ ...row, source: "validated" as const }));
};

const finalizeExtractedRows = async (
  reportContent: unknown,
  language: Language,
  deterministicRows: ExtractedReportRow[],
  candidateRowTexts: string[],
  panelCounts: Record<string, number>
) => {
  if (reportContentHasVisualInput(reportContent)) {
    const primaryVisualContent = getPrimaryVisualReportContent(reportContent, 24);
    const visualRows = await extractVisibleBloodworkRowsFromVisualReport(primaryVisualContent, language).catch(() => []);
    let combinedRows = [...deterministicRows, ...visualRows];
    let completeness = computeExtractionCompleteness(combinedRows, candidateRowTexts, panelCounts);

    const verifiedRows = await verifyVisibleBloodworkRowsFromVisualReport(
      reportContent,
      language,
      combinedRows
    ).catch(() => []);

    if (verifiedRows.length > 0) {
      combinedRows = [...combinedRows, ...verifiedRows];
      completeness = computeExtractionCompleteness(combinedRows, candidateRowTexts, panelCounts);
    }

    const differentialRows = await extractDifferentialCountRowsFromVisualReport(
      getFirstPagePrimaryVisualReportContent(primaryVisualContent, 3),
      language
    ).catch(() => []);
    if (differentialRows.length > 0) {
      combinedRows = [...combinedRows, ...differentialRows];
      completeness = computeExtractionCompleteness(combinedRows, candidateRowTexts, panelCounts);
    }

    combinedRows = enforceDifferentialLabelStrictness(combinedRows, candidateRowTexts);

    return {
      combinedRows,
      candidateRowTexts,
      panelCounts,
      completeness
    };
  }

  const extractedRows = await extractStructuredReportRows(reportContent, language, candidateRowTexts).catch(() => []);
  let combinedRows = [...deterministicRows, ...extractedRows];
  let completeness = computeExtractionCompleteness(combinedRows, candidateRowTexts, panelCounts);

  if (completeness.level !== "complete") {
    const retryRows = await extractStructuredReportRowsRetry(
      reportContent,
      language,
      candidateRowTexts,
      combinedRows
    ).catch(() => []);
    if (retryRows.length > 0) {
      combinedRows = [...combinedRows, ...retryRows];
      completeness = computeExtractionCompleteness(combinedRows, candidateRowTexts, panelCounts);
    }
  }

  const validatedRows = await validateExtractedRowsAgainstReport(
    reportContent,
    language,
    combinedRows,
    candidateRowTexts
  ).catch(() => []);
  if (validatedRows.length > 0) {
    combinedRows = [...combinedRows, ...validatedRows];
    completeness = computeExtractionCompleteness(combinedRows, candidateRowTexts, panelCounts);
  }

  combinedRows = enforceDifferentialLabelStrictness(combinedRows, candidateRowTexts);

  return {
    combinedRows,
    candidateRowTexts,
    panelCounts,
    completeness
  };
};

const backfillExpectedMarkers = async (
  reportContent: unknown,
  language: Language,
  extractedRows: ExtractedReportRow[]
): Promise<ExtractedReportRow[]> => {
  const existingAliases = new Set(
    extractedRows.flatMap((row) => getMarkerAliases(row.marker))
  );
  const missing = EXPECTED_COMMON_MARKERS.filter(
    (marker) => !getMarkerAliases(marker).some((alias) => existingAliases.has(alias))
  );

  if (missing.length === 0) {
    return extractedRows;
  }

  const recoveredRows = await extractExpectedMarkers(reportContent, language, missing).catch(() => []);
  const evidencedRows = recoveredRows.filter((row) =>
    reportExplicitlyMentionsMarker(reportContent, row.marker)
  );

  return [...extractedRows, ...evidencedRows];
};

/**
 * Analyzes bloodwork data using OpenAI and recommends nutrition products
 */
export async function analyzeBloodwork(
  bloodworkData: BloodworkData
): Promise<BloodworkAnalysis> {
  const language = getCurrentLanguage();
  const cacheKey = buildAnalysisCacheKey("bloodwork", {
    bloodworkData,
    supplementIds: AVAILABLE_SUPPLEMENTS.map((s) => s.id),
    language
  });
  const supplementsList = AVAILABLE_SUPPLEMENTS.map(
    (s) => `${s.name} (${s.size}) - Benefits: ${s.benefits.join(", ")} - Key Nutrients: ${s.keyNutrients.join(", ")}`
  ).join("\n");

  const bloodworkSummary = Object.entries(bloodworkData)
    .map(([key, data]) => `${key}: ${data.value} ${data.unit}${data.referenceRange ? ` (Reference: ${data.referenceRange})` : ""}`)
    .join("\n");

  const prompt = `You are a health and nutrition expert analyzing bloodwork results. Based on the following bloodwork data, provide personalized nutrition recommendations from our available products.

BLOODWORK DATA:
${bloodworkSummary}

AVAILABLE NUTRITION PRODUCTS:
${supplementsList}

Please analyze the bloodwork and provide:
1. A brief summary of the overall health status
2. Key concerns or areas that need attention (ONLY values outside reference ranges)
3. Positive findings or strengths (ONLY values clearly within healthy ranges)
4. Specific nutrition recommendations from our list that would address any deficiencies or support optimal health
5. Detailed insights by health category. For each abnormal or noteworthy issue, explain in plain consumer-friendly language what was found and why it may matter in everyday terms.

Before giving recommendations, confirm you checked common lipid/metabolic markers if present: LDL, HDL, total cholesterol, triglycerides (TG), non-HDL, ApoB, glucose, HbA1c. If any of these are missing from the report, explicitly note them as "missing/unreported".

Only recommend items from AVAILABLE SUPPLEMENTS. Do NOT recommend branded blends (e.g., Just Slim, Just Mushroom) or anything not listed.
Recommendations must be between 3 and 8 items. Increase the number of recommendations when there are multiple or severe deficiencies. Each supplementName must exactly match a name from AVAILABLE SUPPLEMENTS.
Each recommendation MUST cite the specific abnormal biomarker(s) and their values/ranges that justify it. Do not recommend anything without a clear, abnormal biomarker-based reason. Do not include generic or default nutrition products.
Base blend rule: include exactly one protein base (Pea Protein Original OR Pea Protein Cacao) and exactly one fiber base (Australian Instant Oats OR Organic Psyllium Husk) as part of the recommendations, unless contraindicated by the bloodwork or user sensitivities.
Base blend rule: include exactly one protein base (Pea Protein Original OR Pea Protein Cacao) and exactly one fiber base (Australian Instant Oats OR Organic Psyllium Husk) as part of the recommendations, unless contraindicated by the bloodwork or user sensitivities.

IMPORTANT: For dosage recommendations, provide ACCURATE daily intake amounts based on scientific evidence and the severity of deficiency. Only use the guidance below for nutrition products you already decided to recommend; do NOT use it to choose nutrition products.
Use grams only (e.g., "3 g per serving size"). Do NOT use tablespoons/teaspoons or capsules in the dosage string.
Also include numeric field dosageGramsPerDay (number of grams per serving size).
Ensure the total daily grams across all recommended nutrition products sums to 10 g per serving size (2 tbsp total blend).
- Spirulina: 3-5g per serving size (1 teaspoon = ~3g)
- Chlorella: 2-3g per serving size
- Wheatgrass: 3-5g per serving size (1 teaspoon)
- Moringa: 2-3g per serving size
- Turmeric: 1-3g per serving size (500mg-1g for mild support, 2-3g for significant inflammation)
- Ashwagandha: 300-600mg per serving size (0.3-0.6g)
- Maca Root: 3-5g per serving size
- Beetroot: 5-10g per serving size
- Matcha: 1-2g per serving size (1/2 to 1 teaspoon)
- Cacao: 5-10g per serving size (1-2 teaspoons)
- Chia Seeds: 1-2 tablespoons per serving size (15-30g)
- Flax Seeds: 1-2 tablespoons per serving size (ground)
- Hemp Seeds: 2-3 tablespoons per serving size (30-45g)
- Goji Berries: 10-30g per serving size (1-3 tablespoons)
- Acai: 5-10g per serving size (powder)
- Mushroom blends: 1-3g per serving size depending on type
- Collagen: 10-20g per serving size
- Protein powders: 20-30g per serving size

ADJUST dosages based on:
- Severity of deficiency (higher for severe deficiencies)
- Multiple deficiencies (may need higher amounts)
- Age, weight, and health status
- Specific biomarker levels

Do NOT use generic "5g per serving size" for everything - be specific and evidence-based!

Respond in JSON format with this structure:
{
  "summary": "Brief overall health summary",
  "concerns": ["concern 1", "concern 2"],
  "strengths": ["strength 1", "strength 2"],
  "recommendations": [
    {
      "supplementId": "supplement-id",
      "supplementName": "Nutrition Product Name",
      "reason": "Why this nutrition product is recommended based on specific bloodwork values",
      "priority": "high|medium|low",
      "dosage": "Accurate daily intake amount in grams (e.g., '3 g per serving size')",
      "dosageGramsPerDay": 3
    }
  ],
  "detailedInsights": [
    {
      "category": "Category name",
      "findings": "What the bloodwork shows",
      "impact": "What this means for health"
    }
  ]
}

${getLanguageInstruction(language)}`;

  try {
    const response = await createChatCompletion({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a knowledgeable health and nutrition expert who analyzes bloodwork and provides evidence-based nutrition recommendations with ACCURATE dosages that vary based on the specific nutrition product and severity of deficiencies. Use plain, non-medical language for concerns, strengths, and detailed insights so a layperson can understand. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: ANALYSIS_TEMPERATURE
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const analysis: BloodworkAnalysis = JSON.parse(content);
    const normalized = normalizeRecommendations(analysis);
    const localized = await localizeBloodworkAnalysis(normalized, language);
    return localized;
  } catch (error) {
    console.error("Error analyzing bloodwork:", error);
    throw new Error("Failed to analyze bloodwork. Please try again.");
  }
}

export async function generateSupplementRecommendationsFromContext(input: {
  summary: string;
  context?: string;
}): Promise<BloodworkAnalysis> {
  const language = getCurrentLanguage();
  const cacheKey = buildAnalysisCacheKey("context-recommendations", {
    input,
    supplementIds: AVAILABLE_SUPPLEMENTS.map((s) => s.id),
    language
  });
  const supplementsList = AVAILABLE_SUPPLEMENTS.map(
    (s) => `${s.id}: ${s.name} - Benefits: ${s.benefits.join(", ")} - Key Nutrients: ${s.keyNutrients.join(", ")}`
  ).join("\n");

  const prompt = `You are a health and nutrition expert. Based on the non-bloodwork image analysis below, suggest suitable nutrition products from our catalog that may support the issue described.

IMAGE ANALYSIS SUMMARY:
${input.summary}

EXTRA CONTEXT:
${input.context || "None"}

AVAILABLE NUTRITION PRODUCTS:
${supplementsList}

Requirements:
- Only recommend items from AVAILABLE SUPPLEMENTS.
- Do not diagnose disease or claim certainty from the image alone.
- Recommendations must be cautious, support-oriented, and tied to the visible issue or symptom pattern.
- Return between 2 and 6 recommendations.
- Each supplementName must exactly match a name from AVAILABLE SUPPLEMENTS.
- Keep reasons plain and user-friendly.
- Include one short summary, 1-3 concerns, 0-2 strengths, and 1-3 detailed insights.
- Include dosage and dosageGramsPerDay when appropriate.

Respond in JSON format with this structure:
{
  "summary": "Brief overall summary",
  "concerns": ["concern 1", "concern 2"],
  "strengths": ["strength 1"],
  "recommendations": [
    {
      "supplementId": "supplement-id",
      "supplementName": "Nutrition Product Name",
      "reason": "Why this nutrition product may help",
      "priority": "high|medium|low",
      "dosage": "Daily intake amount in grams",
      "dosageGramsPerDay": 3
    }
  ],
  "detailedInsights": [
    {
      "category": "Category name",
      "findings": "What was observed",
      "impact": "Why it matters"
    }
  ]
}

${getLanguageInstruction(language)}`;

  try {
    const response = await createChatCompletion({
      model: ANALYSIS_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You provide cautious, non-diagnostic nutrition recommendations from image-analysis context. Always return valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 1400
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const analysis: BloodworkAnalysis = JSON.parse(content);
    const normalized = normalizeRecommendations(analysis);
    const localized = await localizeBloodworkAnalysis(normalized, language);
    return localized;
  } catch (error) {
    console.error("Error generating supplement recommendations from context:", error);
    throw new Error("Failed to generate supplement recommendations.");
  }
}

/**
 * Analyzes bloodwork from a PDF file by converting it to images
 */
export async function analyzeBloodworkPdf(file: File): Promise<BloodworkAnalysis> {
  const language = getCurrentLanguage();
  const pdfFingerprint = `${file.name}:${file.size}:${file.lastModified}`;

  const supplementsList = AVAILABLE_SUPPLEMENTS.map(
    (s) => `${s.id}: ${s.name} - Benefits: ${s.benefits.join(", ")} - Key Nutrients: ${s.keyNutrients.join(", ")}`
  ).join("\n");

  try {
    // Convert PDF to images
    const [images, extractedPdfText, structuredPages] = await Promise.all([
      pdfToImages(file),
      extractTextFromPdf(file).catch(() => ""),
      extractStructuredTextPagesFromPdf(file).catch(() => [])
    ]);

    if (images.length === 0) {
      throw new Error("No pages found in PDF");
    }

    // For multi-page PDFs, process page-by-page through the stabilized image pipeline
    // to avoid sparse field extraction and cross-page confusion.
    if (images.length > 1) {
      return analyzeBloodworkImages(
        images.map((pageImage) => ({
          base64: pageImage,
          fileType: "image/jpeg"
        }))
      );
    }

  // Analyze all pages for full coverage
  const allPages = images;

    const rowCropParts = await buildRowCropImageParts(
      allPages.map((pageImage, index) => ({
        base64: pageImage,
        mimeType: "image/jpeg",
        rowBands: normalizeSourceRowBands([
          {
            pageNumber: index + 1,
            rows: structuredPages.find((page) => page.pageNumber === index + 1)?.rows || []
          }
        ])
      }))
    );
    const verificationReportContent = [
      {
        type: "text" as const,
        text: "PDF bloodwork report with additional zoomed row strips for exact value verification."
      },
      ...allPages.map((pageImage) => ({
        type: "image_url" as const,
        image_url: {
          url: `data:image/jpeg;base64,${pageImage}`,
          detail: "high" as const
        }
      })),
      {
        type: "text" as const,
        text: VISUAL_PRIMARY_BOUNDARY_TEXT
      },
      ...rowCropParts
    ];

    const response = await createChatCompletion({
      model: ANALYSIS_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a health and nutrition expert who analyzes bloodwork reports. Extract all biomarker values, compare them to reference ranges, and provide personalized nutrition recommendations with ACCURATE, evidence-based dosages. Adjust dosages based on the severity of deficiencies shown in the bloodwork. Use plain, non-medical language for concerns, strengths, and detailed insights so a layperson can understand. Always respond with valid JSON."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this multi-page bloodwork report (converted from PDF) and extract all biomarker values with their units and reference ranges across ALL pages.

AVAILABLE NUTRITION PRODUCTS:
${supplementsList}

Please provide:
1. A brief summary of the overall health status
2. Key concerns or areas that need attention (ONLY values outside reference ranges)
3. Positive findings or strengths (ONLY values clearly within healthy ranges)
4. Specific nutrition recommendations from our list that would address any deficiencies or support optimal health
5. Detailed insights by health category (focus on abnormal values; avoid listing all normal markers)

${BLOODWORK_EXTRACTION_RULES}

OCR-EXTRACTED PDF TEXT (may be incomplete, use to cross-check tables and units):
${extractedPdfText || "No OCR text available"}

Before giving recommendations, confirm you checked common lipid/metabolic markers if present: LDL, HDL, total cholesterol, triglycerides (TG), non-HDL, ApoB, glucose, HbA1c. If any of these are missing from the report, explicitly note them as "missing/unreported".

Use layman-friendly language (avoid medical jargon, define any necessary terms).

Only recommend items from AVAILABLE SUPPLEMENTS. Do NOT recommend branded blends (e.g., Just Slim, Just Mushroom) or anything not listed.
Recommendations must be between 3 and 8 items. Increase the number of recommendations when there are multiple or severe deficiencies. Each supplementName must exactly match a name from AVAILABLE SUPPLEMENTS.
Each recommendation MUST cite the specific abnormal biomarker(s) and their values/ranges that justify it. Do not recommend anything without a clear, abnormal biomarker-based reason. Do not include generic or default nutrition products.
Base blend rule: include exactly one protein base (Pea Protein Original OR Pea Protein Cacao) and exactly one fiber base (Australian Instant Oats OR Organic Psyllium Husk) as part of the recommendations, unless contraindicated by the bloodwork or user sensitivities.

IMPORTANT: For dosage recommendations, provide ACCURATE daily intake amounts based on scientific evidence and the severity of deficiency. Only use the guidance below for nutrition products you already decided to recommend; do NOT use it to choose nutrition products.
Use grams only (e.g., "3 g per serving size"). Do NOT use tablespoons/teaspoons or capsules in the dosage string.
Also include numeric field dosageGramsPerDay (number of grams per serving size).
Ensure the total daily grams across all recommended nutrition products sums to 10 g per serving size (2 tbsp total blend).
- Spirulina: 3-5g per serving size (1 teaspoon = ~3g)
- Chlorella: 2-3g per serving size
- Wheatgrass: 3-5g per serving size (1 teaspoon)
- Moringa: 2-3g per serving size
- Turmeric: 1-3g per serving size (500mg-1g for mild support, 2-3g for significant inflammation)
- Ashwagandha: 300-600mg per serving size (0.3-0.6g)
- Maca Root: 3-5g per serving size
- Beetroot: 5-10g per serving size
- Matcha: 1-2g per serving size (1/2 to 1 teaspoon)
- Cacao: 5-10g per serving size (1-2 teaspoons)
- Chia Seeds: 1-2 tablespoons per serving size (15-30g)
- Flax Seeds: 1-2 tablespoons per serving size (ground)
- Hemp Seeds: 2-3 tablespoons per serving size (30-45g)
- Goji Berries: 10-30g per serving size (1-3 tablespoons)
- Acai: 5-10g per serving size (powder)
- Mushroom blends: 1-3g per serving size depending on type
- Collagen: 10-20g per serving size
- Protein powders: 20-30g per serving size

ADJUST dosages based on:
- Severity of deficiency (higher for severe deficiencies)
- Multiple deficiencies (may need higher amounts)
- Age, weight, and health status
- Specific biomarker levels

Do NOT use generic "5g per serving size" for everything - be specific and evidence-based!

Respond in JSON format with this structure:
{
  "summary": "Brief overall health summary",
  "concerns": ["concern 1", "concern 2"],
  "strengths": ["strength 1", "strength 2"],
  "recommendations": [
    {
      "supplementId": "supplement-id",
      "supplementName": "Nutrition Product Name",
      "reason": "Why this nutrition product is recommended based on the bloodwork",
      "priority": "high|medium|low",
      "dosage": "Daily intake amount in grams (e.g., '5 g per serving size')",
      "dosageGramsPerDay": 5
    }
  ],
  "detailedInsights": [
    {
      "category": "Category name (e.g., Cardiovascular, Immune System)",
      "findings": "What the bloodwork shows",
      "impact": "What this means for health"
    }
  ]
}

${getLanguageInstruction(language)}`
            },
            ...allPages.map((pageImage) => ({
              type: "image_url" as const,
              image_url: {
                url: `data:image/jpeg;base64,${pageImage}`,
                detail: "high"
              }
            }))
          ]
        }
      ],
      response_format: { type: "json_object" },
      temperature: ANALYSIS_TEMPERATURE,
      max_tokens: 2000
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const analysis: BloodworkAnalysis = JSON.parse(content);
    const deterministic = parseStructuredPdfRows(structuredPages);
    const finalizedRows = await finalizeExtractedRows(
      verificationReportContent,
      language,
      deterministic.rows,
      deterministic.candidateRowTexts,
      deterministic.panelCounts
    );
    const normalized = normalizeRecommendations(
      mergeAnalysisWithParsedRows(analysis, finalizedRows.combinedRows, {
        candidateRowTexts: finalizedRows.candidateRowTexts,
        panelCounts: finalizedRows.panelCounts
      })
    );
    const localized = await localizeBloodworkAnalysis(normalized, language);
    return localized;
  } catch (error) {
    console.error("Error analyzing PDF bloodwork file:", error);
    throw new Error("Failed to analyze PDF file. Please ensure the PDF contains clear bloodwork data.");
  }
}

/**
 * Analyzes bloodwork from an uploaded image file using OpenAI Vision
 */
export async function analyzeBloodworkFile(
  base64Image: string,
  fileType: string
): Promise<BloodworkAnalysis> {
  const language = getCurrentLanguage();
  const cacheKey = buildAnalysisCacheKey("image", {
    imageHash: hashString(base64Image),
    fileType,
    supplementIds: AVAILABLE_SUPPLEMENTS.map((s) => s.id),
    language
  });
  const supplementsList = AVAILABLE_SUPPLEMENTS.map(
    (s) => `${s.id}: ${s.name} - Benefits: ${s.benefits.join(", ")} - Key Nutrients: ${s.keyNutrients.join(", ")}`
  ).join("\n");

  const imageFormat = normalizeImageMimeType(fileType);

  try {
    const processedImage = await preprocessBloodworkImage(base64Image, imageFormat).catch(() => ({
      base64: base64Image,
      mimeType: imageFormat
    }));
    const focusImage = await createBloodworkFocusCrop(base64Image, imageFormat).catch(() => null);
    const imageOcr = await extractImageOcrBundle([
      { base64: processedImage.base64, fileType: processedImage.mimeType, label: "Uploaded image" }
    ]);
    const rowCropPartsProcessed = await buildRowCropImageParts([
      {
        base64: processedImage.base64,
        mimeType: processedImage.mimeType,
        rowBands: imageOcr.rowBands
      }
    ]);
    const rowCropPartsOriginal = await buildRowCropImageParts([
      {
        base64: base64Image,
        mimeType: imageFormat,
        rowBands: imageOcr.rowBands
      }
    ]);
    const splitBands = [
      { top: 0, bottom: 0.42 },
      { top: 0.3, bottom: 0.76 },
      { top: 0.62, bottom: 1 }
    ];
    const yValues = imageOcr.rowBands
      .map((row) => row.y)
      .filter((y): y is number => typeof y === "number" && Number.isFinite(y));
    const minY = yValues.length > 0 ? Math.max(0, Math.min(...yValues) - 40) : 0;
    const maxY = yValues.length > 0 ? Math.max(...yValues) + 80 : 1800;
    const span = Math.max(320, maxY - minY);

    const splitCrops = await cropImageBands(
      base64Image,
      imageFormat,
      splitBands.map((band) => ({
        top: minY + band.top * span,
        bottom: minY + band.bottom * span
      }))
    ).catch(() => []);
    const splitImageParts = splitCrops.map((crop) => ({
      type: "image_url" as const,
      image_url: {
        url: `data:${crop.mimeType};base64,${crop.base64}`,
        detail: "high" as const
      }
    }));
    const rowCropParts = [...splitImageParts, ...rowCropPartsOriginal, ...rowCropPartsProcessed];
    const verificationReportContent = [
      {
        type: "text" as const,
        text: "Single bloodwork report image. If present, first image is table-focused crop, second is original capture, third is contrast-enhanced preprocessing, followed by zoomed row strips for exact value verification."
      },
      ...(focusImage
        ? [
            {
              type: "image_url" as const,
              image_url: {
                url: `data:${focusImage.mimeType};base64,${focusImage.base64}`,
                detail: "high" as const
              }
            }
          ]
        : []),
      {
        type: "image_url" as const,
        image_url: {
          url: `data:${imageFormat};base64,${base64Image}`,
          detail: "high" as const
        }
      },
      {
        type: "image_url" as const,
        image_url: {
          url: `data:${processedImage.mimeType};base64,${processedImage.base64}`,
          detail: "high" as const
        }
      },
      {
        type: "text" as const,
        text: VISUAL_PRIMARY_BOUNDARY_TEXT
      },
      ...rowCropParts
    ];

    const response = await createChatCompletion({
      model: ANALYSIS_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a health and nutrition expert who analyzes bloodwork reports. Extract all biomarker values, compare them to reference ranges, and provide personalized nutrition recommendations with ACCURATE, evidence-based dosages. Adjust dosages based on the severity of deficiencies shown in the bloodwork. Use plain, non-medical language for concerns, strengths, and detailed insights so a layperson can understand. Always respond with valid JSON."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this bloodwork report image and extract all biomarker values with their units and reference ranges.

AVAILABLE NUTRITION PRODUCTS:
${supplementsList}

Please provide:
1. A brief summary of the overall health status
2. Key concerns or areas that need attention (ONLY values outside reference ranges)
3. Positive findings or strengths (ONLY values clearly within healthy ranges)
4. Specific nutrition recommendations from our list that would address any deficiencies or support optimal health
5. Detailed insights by health category. For each abnormal or noteworthy issue, explain in plain consumer-friendly language what was found and why it may matter in everyday terms.

${BLOODWORK_EXTRACTION_RULES}

Use layman-friendly language (avoid medical jargon, define any necessary terms).

Only recommend items from AVAILABLE SUPPLEMENTS. Do NOT recommend branded blends (e.g., Just Slim, Just Mushroom) or anything not listed.
Recommendations must be between 3 and 8 items. Increase the number of recommendations when there are multiple or severe deficiencies. Each supplementName must exactly match a name from AVAILABLE SUPPLEMENTS.
Each recommendation MUST cite the specific abnormal biomarker(s) and their values/ranges that justify it. Do not recommend anything without a clear, abnormal biomarker-based reason. Do not include generic or default nutrition products.

IMPORTANT: For dosage recommendations, provide ACCURATE daily intake amounts based on scientific evidence and the severity of deficiency. Only use the guidance below for nutrition products you already decided to recommend; do NOT use it to choose nutrition products.
Use grams only (e.g., "3 g per serving size"). Do NOT use tablespoons/teaspoons or capsules in the dosage string.
Also include numeric field dosageGramsPerDay (number of grams per serving size).
Ensure the total daily grams across all recommended nutrition products sums to 10 g per serving size (2 tbsp total blend).
- Spirulina: 3-5g per serving size (1 teaspoon = ~3g)
- Chlorella: 2-3g per serving size
- Wheatgrass: 3-5g per serving size (1 teaspoon)
- Moringa: 2-3g per serving size
- Turmeric: 1-3g per serving size (500mg-1g for mild support, 2-3g for significant inflammation)
- Ashwagandha: 300-600mg per serving size (0.3-0.6g)
- Maca Root: 3-5g per serving size
- Beetroot: 5-10g per serving size
- Matcha: 1-2g per serving size (1/2 to 1 teaspoon)
- Cacao: 5-10g per serving size (1-2 teaspoons)
- Chia Seeds: 1-2 tablespoons per serving size (15-30g)
- Flax Seeds: 1-2 tablespoons per serving size (ground)
- Hemp Seeds: 2-3 tablespoons per serving size (30-45g)
- Goji Berries: 10-30g per serving size (1-3 tablespoons)
- Acai: 5-10g per serving size (powder)
- Mushroom blends: 1-3g per serving size depending on type
- Collagen: 10-20g per serving size
- Protein powders: 20-30g per serving size

ADJUST dosages based on:
- Severity of deficiency (higher for severe deficiencies)
- Multiple deficiencies (may need higher amounts)
- Age, weight, and health status
- Specific biomarker levels

Do NOT use generic "5g per serving size" for everything - be specific and evidence-based!

Respond in JSON format with this structure:
{
  "summary": "Brief overall health summary",
  "concerns": ["concern 1", "concern 2"],
  "strengths": ["strength 1", "strength 2"],
  "recommendations": [
    {
      "supplementId": "supplement-id",
      "supplementName": "Nutrition Product Name",
      "reason": "Why this nutrition product is recommended based on the bloodwork",
      "priority": "high|medium|low",
      "dosage": "Daily intake amount in grams (e.g., '5 g per serving size')",
      "dosageGramsPerDay": 5
    }
  ],
  "detailedInsights": [
    {
      "category": "Category name (e.g., Cardiovascular, Immune System)",
      "findings": "What the bloodwork shows",
      "impact": "What this means for health"
    }
  ]
}

${getLanguageInstruction(language)}`
            },
            ...(focusImage
              ? [
                  {
                    type: "image_url" as const,
                    image_url: {
                      url: `data:${focusImage.mimeType};base64,${focusImage.base64}`,
                      detail: "high" as const
                    }
                  }
                ]
              : []),
            {
              type: "image_url",
              image_url: {
                url: `data:${imageFormat};base64,${base64Image}`,
                detail: "high"
              }
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${processedImage.mimeType};base64,${processedImage.base64}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      temperature: ANALYSIS_TEMPERATURE,
      max_tokens: 2000
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const analysis: BloodworkAnalysis = JSON.parse(content);
    const finalizedRows = await finalizeExtractedRows(
      verificationReportContent,
      language,
      imageOcr.rows,
      imageOcr.candidateRowTexts,
      imageOcr.panelCounts
    );
    const normalized = normalizeRecommendations(
      mergeAnalysisWithParsedRows(analysis, finalizedRows.combinedRows, {
        candidateRowTexts: finalizedRows.candidateRowTexts,
        panelCounts: finalizedRows.panelCounts
      })
    );
    const localized = await localizeBloodworkAnalysis(normalized, language);
    return localized;
  } catch (error) {
    console.error("Error analyzing bloodwork file:", error);
    throw new Error("Failed to analyze bloodwork file. Please ensure the image is clear and contains bloodwork data.");
  }
}

/**
 * Analyzes bloodwork from multiple uploaded image files using OpenAI Vision
 */
export async function analyzeBloodworkImages(
  images: { base64: string; fileType: string }[]
): Promise<BloodworkAnalysis> {
  if (images.length === 0) {
    throw new Error("No images provided for analysis.");
  }

  // Process each image independently to avoid cross-page value bleed (especially differential counts).
  const perPageAnalyses: BloodworkAnalysis[] = [];
  for (const image of images) {
    const pageAnalysis = await analyzeBloodworkFile(image.base64, image.fileType);
    perPageAnalyses.push(pageAnalysis);
  }

  const joinedSummary = perPageAnalyses
    .map((analysis, index) => `Page ${index + 1}: ${analysis.summary}`)
    .join(" ");

  const concerns = perPageAnalyses.flatMap((analysis, index) =>
    (analysis.concerns || []).map((line) => `Page ${index + 1}: ${line}`)
  );
  const strengths = perPageAnalyses.flatMap((analysis, index) =>
    (analysis.strengths || []).map((line) => `Page ${index + 1}: ${line}`)
  );

  const detailedInsights = perPageAnalyses.flatMap((analysis, index) =>
    (analysis.detailedInsights || []).map((insight) => ({
      category: `Page ${index + 1}${insight.category ? ` - ${insight.category}` : ""}`,
      findings: insight.findings,
      impact: insight.impact
    }))
  );

  const isMeaningfulText = (value?: string) => {
    const normalized = (value || "").trim();
    if (!normalized) return false;
    if (/^(?:-|--|---|n\/?a|na|nil|none|\.|\.\.\.|\?+)$/i.test(normalized)) return false;
    return true;
  };

  const flattenedParsedRows = perPageAnalyses.flatMap((analysis, index) =>
    (analysis.parsedRows || [])
      .filter(
        (row) =>
          isMeaningfulText(row.value) ||
          isMeaningfulText(row.referenceRange) ||
          isMeaningfulText(row.unit)
      )
      .map((row) => ({
        ...row,
        panel: `Page ${index + 1}${row.panel ? ` - ${row.panel}` : ""}`
      }))
  );

  const parsedRowsByKey = new Map<string, ParsedReportRow>();
  for (const row of flattenedParsedRows) {
    const key = `${row.panel || ""}|${row.markerId}`;
    const existing = parsedRowsByKey.get(key);
    if (!existing) {
      parsedRowsByKey.set(key, row);
      continue;
    }

    const rowScore =
      (isMeaningfulText(row.value) ? 4 : 0) +
      (isMeaningfulText(row.referenceRange) ? 3 : 0) +
      (isMeaningfulText(row.unit) ? 2 : 0) +
      (row.status !== "unknown" ? 1 : 0);
    const existingScore =
      (isMeaningfulText(existing.value) ? 4 : 0) +
      (isMeaningfulText(existing.referenceRange) ? 3 : 0) +
      (isMeaningfulText(existing.unit) ? 2 : 0) +
      (existing.status !== "unknown" ? 1 : 0);

    if (rowScore > existingScore) {
      parsedRowsByKey.set(key, row);
    }
  }

  const parsedRows = [...parsedRowsByKey.values()];

  const recommendationMap = new Map<string, SupplementRecommendation>();
  for (const analysis of perPageAnalyses) {
    for (const recommendation of analysis.recommendations || []) {
      if (!recommendationMap.has(recommendation.supplementId)) {
        recommendationMap.set(recommendation.supplementId, recommendation);
      }
    }
  }

  const extractionLevels = perPageAnalyses.map((analysis) => analysis.extractionCompleteness);
  const extractionCompleteness = extractionLevels.includes("low-confidence")
    ? "low-confidence"
    : extractionLevels.includes("partial")
    ? "partial"
    : "complete";

  const missingVisibleRowsCount = perPageAnalyses.reduce(
    (total, analysis) => total + (analysis.missingVisibleRowsCount || 0),
    0
  );

  return {
    summary: joinedSummary || "Page-by-page analysis completed.",
    concerns,
    strengths,
    recommendations: [...recommendationMap.values()].slice(0, 8),
    detailedInsights,
    parsedRows,
    extractionCompleteness,
    missingVisibleRowsCount
  };
}

export async function analyzeHealthDocumentBundle(files: File[]): Promise<BloodworkAnalysis> {
  const language = getCurrentLanguage();
  const cacheKey = buildAnalysisCacheKey("document-bundle", {
    files: files.map((file) => ({
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      type: file.type
    })),
    supplementIds: AVAILABLE_SUPPLEMENTS.map((s) => s.id),
    language
  });
  const cached = getCachedAnalysis(cacheKey);
  if (cached) {
    return cached;
  }

  const supplementsList = AVAILABLE_SUPPLEMENTS.map(
    (s) => `${s.id}: ${s.name} - Benefits: ${s.benefits.join(", ")} - Key Nutrients: ${s.keyNutrients.join(", ")}`
  ).join("\n");

  const bundleContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "high" } }
  > = [];
  const deterministicRows: ExtractedReportRow[] = [];
  const candidateRowTexts: string[] = [];
  const panelCounts: Record<string, number> = {};

  for (const file of files) {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (isPdf) {
      const [pages, extractedText, structuredPages] = await Promise.all([
        pdfToImages(file),
        extractTextFromPdf(file).catch(() => ""),
        extractStructuredTextPagesFromPdf(file).catch(() => [])
      ]);

      const parsedPdf = parseStructuredPdfRows(structuredPages);
      deterministicRows.push(...parsedPdf.rows);
      candidateRowTexts.push(...parsedPdf.candidateRowTexts);
      Object.entries(parsedPdf.panelCounts).forEach(([panel, count]) => {
        panelCounts[panel] = (panelCounts[panel] || 0) + count;
      });
      bundleContent.push({
        type: "text",
        text: `Document: ${file.name}\nType: PDF health report\nOCR text:\n${extractedText || "No OCR text available"}`
      });

      for (const page of pages) {
        bundleContent.push({
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${page}`,
            detail: "high"
          }
        });
      }
      bundleContent.push({
        type: "text",
        text: `Structured page text for ${file.name}:\n${structuredPages.map((page) => `Page ${page.pageNumber}\n${page.text}`).join("\n\n")}`
      });
      continue;
    }

    const base64 = await fileToBase64Data(file);
    const imageOcr = await extractImageOcrBundle([
      { base64, fileType: file.type, label: file.name }
    ]);
    deterministicRows.push(...imageOcr.rows);
    candidateRowTexts.push(...imageOcr.candidateRowTexts);
    Object.entries(imageOcr.panelCounts).forEach(([panel, count]) => {
      panelCounts[panel] = (panelCounts[panel] || 0) + count;
    });
    if (imageOcr.blocks.length > 0) {
      bundleContent.push({
        type: "text",
        text: imageOcr.blocks.join("\n\n")
      });
    }
    bundleContent.push({
      type: "text",
      text: `Document: ${file.name}\nType: ${file.type || "image health report"}`
    });
    bundleContent.push({
      type: "image_url",
      image_url: {
        url: `data:${normalizeImageMimeType(file.type)};base64,${base64}`,
        detail: "high"
      }
    });
  }

  try {
    const response = await createChatCompletion({
      model: ANALYSIS_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a health and nutrition expert who analyzes uploaded health document sets. The uploaded packet may include bloodwork, ECG reports, imaging/scans, and clinician report pages. Review every uploaded document before summarizing. Do not ignore ECG, imaging, or scan findings just because bloodwork is present. Use plain, non-medical language where possible and always return valid JSON."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this complete uploaded health-document packet.

The document set may include blood test reports, ECG reports, imaging/scans, and mixed clinical documents. You must inspect ALL uploaded documents first and base the result on the entire packet, not just the blood report.

AVAILABLE NUTRITION PRODUCTS:
${supplementsList}

Please provide:
1. A brief summary of the user's overall picture using all uploaded documents
2. Key concerns or findings that need attention, including bloodwork abnormalities AND notable ECG/imaging/report findings
3. Positive findings or strengths from any document in the packet
4. Specific nutrition recommendations from our list that fit the overall packet
5. Detailed insights by health category, including cardiovascular findings if ECG/report findings are present. Explain each issue in plain consumer-friendly language, similar to a health app explanation, but without citations.

Rules:
- Review every uploaded document before summarizing.
- If bloodwork is present, extract biomarker values, units, and reference ranges where visible.
- If ECG or scan findings are present, include them in the summary, concerns, and detailed insights even if they are qualitative rather than numeric.
- Do not pretend a finding came from bloodwork if it came from ECG, imaging, or another report.
- Recommendations must be justified by the overall packet. They may cite abnormal biomarkers, ECG findings, scan findings, or other report findings when relevant.
- If a document is unclear or partially unreadable, mention uncertainty briefly rather than ignoring it.
- Only recommend items from AVAILABLE NUTRITION PRODUCTS. Do NOT recommend branded blends (e.g., Just Slim, Just Mushroom) or anything not listed.
- Recommendations must be between 3 and 8 items when there is enough information. Each supplementName must exactly match a name from AVAILABLE SUPPLEMENTS.
- Use layman-friendly language.
- Base blend rule: include exactly one protein base (Pea Protein Original OR Pea Protein Cacao) and exactly one fiber base (Australian Instant Oats OR Organic Psyllium Husk) unless contraindicated by the findings.

IMPORTANT: For dosage recommendations, provide ACCURATE daily intake amounts based on scientific evidence and the severity of the findings. Only use the guidance below for nutrition products you already decided to recommend; do NOT use it to choose nutrition products.
Use grams only (e.g., "3 g per serving size"). Do NOT use tablespoons/teaspoons or capsules in the dosage string.
Also include numeric field dosageGramsPerDay (number of grams per serving size).
Ensure the total daily grams across all recommended nutrition products sums to 10 g per serving size (2 tbsp total blend).

Respond in JSON format with this structure:
{
  "summary": "Brief overall health summary using all uploaded documents",
  "concerns": ["concern 1", "concern 2"],
  "strengths": ["strength 1", "strength 2"],
  "recommendations": [
    {
      "supplementId": "supplement-id",
      "supplementName": "Nutrition Product Name",
      "reason": "Why this nutrition product is recommended based on the full uploaded packet",
      "priority": "high|medium|low",
      "dosage": "Daily intake amount in grams (e.g., '3 g per serving size')",
      "dosageGramsPerDay": 3
    }
  ],
  "detailedInsights": [
    {
      "category": "Category name",
      "findings": "What the uploaded documents show",
      "impact": "What this means for health"
    }
  ]
}

${getLanguageInstruction(language)}`
            },
            ...bundleContent
          ]
        }
      ],
      response_format: { type: "json_object" },
      temperature: ANALYSIS_TEMPERATURE,
      max_tokens: 2200
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const analysis: BloodworkAnalysis = JSON.parse(content);
    const finalizedRows = await finalizeExtractedRows(
      bundleContent,
      language,
      deterministicRows,
      candidateRowTexts,
      panelCounts
    );
    const normalized = normalizeRecommendations(
      mergeAnalysisWithParsedRows(analysis, finalizedRows.combinedRows, {
        candidateRowTexts: finalizedRows.candidateRowTexts,
        panelCounts: finalizedRows.panelCounts
      })
    );
    const localized = await localizeBloodworkAnalysis(normalized, language);
    setCachedAnalysis(cacheKey, localized);
    return localized;
  } catch (error) {
    console.error("Error analyzing mixed health document bundle:", error);
    throw new Error("Failed to analyze the uploaded document set. Please ensure the files are clear and try again.");
  }
}

/**
 * Generates personalized health insights based on bloodwork analysis
 */
export async function generateHealthInsights(
  bloodworkData: BloodworkData,
  userProfile?: {
    age?: number;
    gender?: string;
    goals?: string[];
  }
): Promise<string> {
  const bloodworkSummary = Object.entries(bloodworkData)
    .map(([key, data]) => `${key}: ${data.value} ${data.unit}`)
    .join("\n");

  const profileInfo = userProfile
    ? `Age: ${userProfile.age || "N/A"}, Gender: ${userProfile.gender || "N/A"}, Goals: ${userProfile.goals?.join(", ") || "N/A"}`
    : "No profile information provided";

  const prompt = `Based on the following bloodwork results and user profile, provide personalized health insights and actionable advice.

BLOODWORK:
${bloodworkSummary}

USER PROFILE:
${profileInfo}

Provide clear, actionable insights that are easy to understand.`;

  try {
    const response = await createChatCompletion({
      model: ANALYSIS_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a compassionate health advisor providing clear, actionable health insights."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return response.choices[0].message.content || "Unable to generate insights.";
  } catch (error) {
    console.error("Error generating insights:", error);
    throw new Error("Failed to generate health insights.");
  }
}

export interface DailyProfileSummaryInput {
  name: string;
  dob?: string;
  gender?: string;
  heightCm?: number;
  weightKg?: number;
  activityLevel?: string;
  exerciseDays?: number;
  minutesPerSession?: number;
  sleepDuration?: string;
  stressLevel?: string;
  bloodPressure?: string;
  fastingGlucoseMmolL?: number;
  hba1c?: number;
  restingHeartRate?: number;
  waistCircumferenceCm?: number;
  bodyFatPercent?: number;
  dietPattern?: string;
  mealsPerDay?: number;
  caffeineIntake?: string;
  waterIntakeCups?: number;
  allergies?: string;
  conditions?: string;
  medications?: string;
  supplements?: string;
  topPriorities?: string;
}

export interface DailyProfileSummary {
  summary: string;
  motivation: string;
}

export interface SupplementContentTranslation {
  benefits: string[];
  keyNutrients: string[];
  description?: string;
}

export interface ChatSupplementRecommendationResult {
  summary: string;
  recommendations: SupplementRecommendation[];
}

export async function localizeAssistantText(
  content: string,
  language: Language
): Promise<string> {
  const trimmed = content.trim();
  if (!trimmed || language === "en") return trimmed || content;

  const cacheKey = buildAnalysisCacheKey("assistant-text-translation", {
    version: "v2",
    language,
    content: trimmed
  });

  if (typeof window !== "undefined") {
    try {
      const cached = persistentStorage.getItem(cacheKey);
      if (cached) return cached;
    } catch {
      // Ignore cache parse/storage errors.
    }
  }

  const response = await createChatCompletion({
    model: ANALYSIS_MODEL,
    messages: [
      {
        role: "system",
        content:
          `You translate app chat replies for display. Respond entirely in ${language === "zh" ? "Simplified Chinese" : "natural Bahasa Melayu used in Malaysia"}. Preserve the original meaning, tone, and numbering. Return plain text only. Never invent placeholder field names, schema terms, or product ids such as supplementName, supplementId, catalog-id, or Exact Catalog Name.`
      },
      {
        role: "user",
        content: trimmed
      }
    ],
    temperature: 0
  });

  const translated = response.choices[0].message.content?.trim();
  if (!translated) {
    throw new Error("No assistant text translation response");
  }

  if (typeof window !== "undefined") {
    try {
      persistentStorage.setItem(cacheKey, translated);
    } catch {
      // Ignore storage errors.
    }
  }

  return translated;
}

export async function generateChatSupplementRecommendations(input: {
  userMessage: string;
  assistantReply?: string;
  conversationContext?: string[];
  language?: Language;
}): Promise<ChatSupplementRecommendationResult | null> {
  const language = input.language ?? getCurrentLanguage();
  const cacheKey = buildAnalysisCacheKey("chat-symptom-recommendations", {
    userMessage: input.userMessage,
    assistantReply: input.assistantReply || "",
    conversationContext: input.conversationContext || [],
    supplementIds: AVAILABLE_SUPPLEMENTS.map((supplement) => supplement.id),
    language
  });

  if (typeof window !== "undefined") {
    try {
      const cached = persistentStorage.getItem(cacheKey);
      if (cached) {
        return JSON.parse(cached) as ChatSupplementRecommendationResult | null;
      }
    } catch {
      // Ignore cache issues.
    }
  }

  const catalog = AVAILABLE_SUPPLEMENTS.map((supplement) => ({
    supplementId: supplement.id,
    supplementName: supplement.name,
    benefits: supplement.benefits,
    keyNutrients: supplement.keyNutrients,
    description: SUPPLEMENT_DESCRIPTIONS[supplement.id] || ""
  }));

  const buildRecommendationPrompt = (broadCatalogFallback: boolean) => `You are a cautious nutrition product recommendation engine for an AI health chat. ${getLanguageInstruction(language)}

Your job:
- Read the user's situation semantically, not by exact keyword matching.
- Understand English, Simplified Chinese, and Bahasa Melayu used in Malaysia symptom descriptions, paraphrases, and implied context.
- Understand broken English, missing grammar, short fragments, casual slang, and common misspellings.
- Cross-check the user's situation ONLY against the provided product catalog.
- Recommend products only when there is a reasonable support-oriented fit.
- Do not diagnose, do not claim treatment, and do not recommend products for emergencies.

Common examples that should usually produce catalog cross-check recommendations if the catalog supports them:
- stomach discomfort, bloating, nausea, indigestion, constipation
- IBS-like symptoms, sensitive stomach, cramping after meals, reflux after spicy or heavy meals
- stomach burning, frequent burping, trapped gas, fullness after small meals, morning nausea, food-poisoning recovery
- knee pain, back pain, neck pain, shoulder pain, joint pain, muscle soreness, inflammation
- headache, migraine, tension-related discomfort
- fatigue, low energy, weakness, dizziness, low stamina, poor focus, mental fatigue
- stress, low mood, immune support, blood sugar support, sugar cravings, heart-supportive nutrition
- anxiety, panic, jittery feelings, palpitations, feverish / coming-down-with-something complaints
- allergy / sinus / sneezing, itchy eyes, mild cough / sore throat / hoarse voice, eye strain, mouth ulcers, toothache / mild oral discomfort, appetite loss, post-illness recovery
- dry skin / eczema-like complaints, acne / breakouts, puffiness / water retention, menopause / hot flashes, sedentary office stiffness
- irregular periods, PMS patterns, period fatigue, heavy periods, cycle-related discomfort
- spotting, breast tenderness, ovulation pain, cycle acne, afternoon crash, post-meal sleepiness, wired-but-tired complaints
- UTI-style urinary discomfort, painful urination, frequent urination, mild bladder discomfort
- nausea, travel nausea, motion sickness, muscle cramps, dehydration-type sluggishness, cholesterol support, low libido
- weight-support phrasing, always hungry / snacking complaints, inflammation / swelling complaints
- heel pain, foot pain, hand pain, ankle pain, slow workout recovery, oily skin, dull skin, hair shedding, weak nails
- delayed period, cycle bloating, after-work fatigue, weak when hungry, junk-food cravings, slow metabolism wording
- constipation subtypes, bloating subtypes, cough subtypes, sinus subtypes, office-strain subtypes, women's-health subtypes, recovery subtypes
- messages like "pain on my knees", "stomach not good", "head very pain", "keep fall sick", or equivalent Chinese phrasing

Safety rules:
- If symptoms sound urgent, severe, or medically high-risk, return no product recommendations.
- If there is no plausible product fit from the catalog, return no product recommendations.
- Avoid energizing products for insomnia, anxiety, palpitations, or similar complaints unless the user is explicitly asking about low energy.
- Avoid constipation/fiber-forward recommendations for diarrhea, vomiting, or likely acute stomach infection.
- Keep recommendations conservative and support-oriented.

${broadCatalogFallback
  ? `Fallback behavior:
- If there is no direct symptom-specific match but the issue is non-urgent, still check whether the catalog has anything that could support the user's broader need such as digestion, hydration-friendly routines, inflammation balance, antioxidant intake, greens intake, recovery, fiber intake, protein intake, mood support, or general wellness.
- For non-urgent complaints, prefer returning 1-3 honest, support-oriented catalog options instead of returning nothing whenever there is a plausible fit.
- If the fit is broad rather than direct, say that clearly in the reason.`
  : `Recommendation threshold:
- Prioritize direct symptom-relevant product fits first.`}

Return valid JSON only with this exact structure:
{
  "shouldRecommend": true,
  "summary": "short summary in the app language",
  "recommendations": [
    {
      "supplementId": "catalog-id",
      "supplementName": "Exact Catalog Name",
      "reason": "short reason in the app language",
      "priority": "high|medium|low",
      "dosage": "short dosage guidance"
    }
  ]
Output rules:
- The JSON structure is internal. Do not echo field names or schema labels inside summary or reason text.
- Summary and reason text must be natural user-facing language only.
- Do not write supplementName, supplementId, catalog-id, or Exact Catalog Name inside any user-visible string.`;

  const requestRecommendationPass = async (broadCatalogFallback: boolean) =>
    createChatCompletion({
      model: ANALYSIS_MODEL,
      messages: [
        {
          role: "system",
          content: buildRecommendationPrompt(broadCatalogFallback)
        },
        {
          role: "user",
          content: JSON.stringify({
            userMessage: input.userMessage,
            assistantReply: input.assistantReply || "",
            conversationContext: input.conversationContext || [],
            catalog,
            mode: broadCatalogFallback ? "broad_catalog_support" : "direct_symptom_support"
          })
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 1200
    });

  const parseRecommendationPayload = (content: string) => JSON.parse(content) as {
    shouldRecommend?: boolean;
    summary?: string;
    recommendations?: Array<{
      supplementId?: string;
      supplementName?: string;
      reason?: string;
      priority?: "high" | "medium" | "low";
      dosage?: string;
    }>;
  };

  const normalizeRecommendationItems = (parsed: ReturnType<typeof parseRecommendationPayload>) =>
    (parsed.recommendations || [])
      .map((recommendation) => {
        const byId = recommendation.supplementId
          ? AVAILABLE_SUPPLEMENTS.find((supplement) => supplement.id === recommendation.supplementId)
          : undefined;
        const byName = recommendation.supplementName
          ? AVAILABLE_SUPPLEMENTS.find((supplement) => supplement.name === recommendation.supplementName)
          : undefined;
        const supplement = byId || byName;
        if (!supplement) return null;

        return {
          supplementId: supplement.id,
          supplementName: supplement.name,
          reason: recommendation.reason?.trim() || supplement.benefits[0] || "May offer general support.",
          priority:
            recommendation.priority === "high" || recommendation.priority === "low"
              ? recommendation.priority
              : "medium",
          dosage: recommendation.dosage?.trim() || "Start with 5-10g per day"
        };
      })
      .filter(
        (
          recommendation
        ): recommendation is {
          supplementId: string;
          supplementName: string;
          reason: string;
          priority: "high" | "medium" | "low";
          dosage: string;
        } => recommendation !== null
      )
      .slice(0, 3);

  const buildResult = (parsed: ReturnType<typeof parseRecommendationPayload>): ChatSupplementRecommendationResult | null => {
    if (!parsed.shouldRecommend || !Array.isArray(parsed.recommendations) || parsed.recommendations.length === 0) {
      return null;
    }

    const recommendations = normalizeRecommendationItems(parsed);
    if (recommendations.length === 0) return null;

    return {
      summary: parsed.summary?.trim() || (language === "zh"
        ? "我根据你的情况和现有产品目录整理了可参考的产品建议。"
        : language === "bm"
        ? "Saya telah semak situasi anda dengan katalog produk yang ada dan jumpa beberapa pilihan yang mungkin sesuai."
        : "I cross-checked your situation against your catalog and found a few products that may be relevant."),
      recommendations
    };
  };

  const directResponse = await requestRecommendationPass(false);
  const directContent = directResponse.choices[0].message.content;
  if (!directContent) {
    throw new Error("No chat recommendation response");
  }

  const directResult = buildResult(parseRecommendationPayload(directContent));
  if (directResult) {
    if (typeof window !== "undefined") {
      try {
        persistentStorage.setItem(cacheKey, JSON.stringify(directResult));
      } catch {
        // Ignore storage errors.
      }
    }
    return directResult;
  }

  const broadResponse = await requestRecommendationPass(true);
  const broadContent = broadResponse.choices[0].message.content;
  if (!broadContent) {
    throw new Error("No broad chat recommendation response");
  }

  const broadResult = buildResult(parseRecommendationPayload(broadContent));
  if (!broadResult) {
    if (typeof window !== "undefined") {
      try {
        persistentStorage.setItem(cacheKey, JSON.stringify(null));
      } catch {
        // Ignore storage errors.
      }
    }
    return null;
  }

  if (typeof window !== "undefined") {
    try {
      persistentStorage.setItem(cacheKey, JSON.stringify(broadResult));
    } catch {
      // Ignore storage errors.
    }
  }

  return broadResult;
}

const getCurrentLanguage = (): Language => {
  const stored = persistentStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === "zh" || stored === "bm") return stored;
  return "en";
};

const getLanguageInstruction = (language: Language): string =>
  language === "zh"
    ? "Respond entirely in Simplified Chinese. Keep supplementName and supplementId unchanged."
    : language === "bm"
    ? "Respond entirely in natural Bahasa Melayu used in Malaysia. Keep supplementName and supplementId unchanged."
    : "Respond in English.";

const localizeBloodworkAnalysis = async (
  analysis: BloodworkAnalysis,
  language: Language
): Promise<BloodworkAnalysis> => {
  if (language === "en") return analysis;

  try {
    return await translateBloodworkAnalysis(analysis, language);
  } catch (error) {
    console.error("Error localizing bloodwork analysis:", error);
    return analysis;
  }
};

export async function translateBloodworkAnalysis(
  analysis: BloodworkAnalysis,
  language: Language
): Promise<BloodworkAnalysis> {
  if (language === "en") return analysis;

  const cacheKey = buildAnalysisCacheKey("bloodwork-translation", {
    language,
    analysis
  });
  const cached = getCachedAnalysis(cacheKey);
  if (cached) return cached;

  const response = await createChatCompletion({
    model: ANALYSIS_MODEL,
    messages: [
      {
        role: "system",
        content:
          `You translate bloodwork analysis JSON for app display. ${getLanguageInstruction(language)} Translate only human-readable text fields. Keep JSON structure, supplementId, supplementName, priority, dosageGramsPerDay, and dosage unchanged. Always return valid JSON.`
      },
      {
        role: "user",
        content: JSON.stringify(analysis)
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 3200
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("No translation response from OpenAI");
  }

  const translated = JSON.parse(content) as BloodworkAnalysis;
  if (
    !translated ||
    typeof translated.summary !== "string" ||
    !Array.isArray(translated.concerns) ||
    !Array.isArray(translated.strengths) ||
    !Array.isArray(translated.recommendations) ||
    !Array.isArray(translated.detailedInsights)
  ) {
    throw new Error("Invalid bloodwork translation payload");
  }
  setCachedAnalysis(cacheKey, translated);
  return translated;
}

export async function translateDailyProfileSummary(
  summary: DailyProfileSummary,
  language: Language
): Promise<DailyProfileSummary> {
  if (language === "en") return summary;

  const cacheKey = buildAnalysisCacheKey("profile-summary-translation", {
    language,
    summary
  });

  if (typeof window !== "undefined") {
    try {
      const cachedRaw = persistentStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as DailyProfileSummary;
        if (cached?.summary && cached?.motivation) return cached;
      }
    } catch {
      // Ignore cache parse/storage errors.
    }
  }

  const response = await createChatCompletion({
    model: ANALYSIS_MODEL,
    messages: [
      {
        role: "system",
        content:
          `You translate profile summary JSON for app display. ${getLanguageInstruction(language)} Keep JSON keys unchanged and return valid JSON.`
      },
      {
        role: "user",
        content: JSON.stringify(summary)
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("No translation response from OpenAI");
  }

  const translated = JSON.parse(content) as DailyProfileSummary;
  if (typeof window !== "undefined") {
    try {
      persistentStorage.setItem(cacheKey, JSON.stringify(translated));
    } catch {
      // Ignore storage errors.
    }
  }
  return translated;
}

export async function translateSupplementContent(
  content: SupplementContentTranslation,
  language: Language
): Promise<SupplementContentTranslation> {
  if (language === "en") return content;

  const cacheKey = buildAnalysisCacheKey("supplement-content-translation", {
    language,
    content
  });

  if (typeof window !== "undefined") {
    try {
      const cachedRaw = persistentStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as SupplementContentTranslation;
        if (Array.isArray(cached?.benefits) && Array.isArray(cached?.keyNutrients)) return cached;
      }
    } catch {
      // Ignore cache parse/storage errors.
    }
  }

  const response = await createChatCompletion({
    model: ANALYSIS_MODEL,
    messages: [
      {
        role: "system",
        content:
          `You translate supplement metadata JSON for app display. ${getLanguageInstruction(language)} Keep JSON keys unchanged and return valid JSON.`
      },
      {
        role: "user",
        content: JSON.stringify(content)
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0
  });

  const translatedRaw = response.choices[0].message.content;
  if (!translatedRaw) {
    throw new Error("No supplement translation response from OpenAI");
  }

  const translated = JSON.parse(translatedRaw) as SupplementContentTranslation;

  if (typeof window !== "undefined") {
    try {
      persistentStorage.setItem(cacheKey, JSON.stringify(translated));
    } catch {
      // Ignore storage errors.
    }
  }

  return translated;
}

export async function generateProfileSummary(
  input: DailyProfileSummaryInput
): Promise<DailyProfileSummary> {
  const language = getCurrentLanguage();
  const cacheKey = buildAnalysisCacheKey("profile-summary", { input, language });
  if (typeof window !== "undefined") {
    try {
      const cachedRaw = persistentStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as DailyProfileSummary;
        if (cached?.summary && cached?.motivation) {
          return cached;
        }
      }
    } catch {
      // Ignore cache parse/storage errors.
    }
  }

  const prompt = `Create a short daily profile health insight for this person.

PROFILE:
- Name: ${input.name || "Unknown"}
- Date of birth: ${input.dob?.trim() || "Not provided"}
- Gender: ${input.gender?.trim() || "Not provided"}
- Height: ${input.heightCm && input.heightCm > 0 ? `${input.heightCm} cm` : "Not provided"}
- Weight: ${input.weightKg && input.weightKg > 0 ? `${input.weightKg} kg` : "Not provided"}
- Activity level: ${input.activityLevel?.trim() || "Not provided"}
- Exercise days per week: ${input.exerciseDays && input.exerciseDays > 0 ? input.exerciseDays : "Not provided"}
- Minutes per session: ${input.minutesPerSession && input.minutesPerSession > 0 ? input.minutesPerSession : "Not provided"}
- Sleep duration: ${input.sleepDuration?.trim() || "Not provided"}
- Stress level: ${input.stressLevel?.trim() || "Not provided"}
- Blood pressure: ${input.bloodPressure?.trim() || "Not provided"}
- Fasting glucose: ${input.fastingGlucoseMmolL && input.fastingGlucoseMmolL > 0 ? `${input.fastingGlucoseMmolL} mmol/L` : "Not provided"}
- HbA1c: ${input.hba1c && input.hba1c > 0 ? `${input.hba1c}%` : "Not provided"}
- Resting heart rate: ${input.restingHeartRate && input.restingHeartRate > 0 ? `${input.restingHeartRate} bpm` : "Not provided"}
- Waist circumference: ${input.waistCircumferenceCm && input.waistCircumferenceCm > 0 ? `${input.waistCircumferenceCm} cm` : "Not provided"}
- Body fat: ${input.bodyFatPercent && input.bodyFatPercent > 0 ? `${input.bodyFatPercent}%` : "Not provided"}
- Diet pattern: ${input.dietPattern?.trim() || "Not provided"}
- Meals per day: ${input.mealsPerDay && input.mealsPerDay > 0 ? input.mealsPerDay : "Not provided"}
- Caffeine intake: ${input.caffeineIntake?.trim() || "Not provided"}
- Water intake: ${input.waterIntakeCups && input.waterIntakeCups > 0 ? `${input.waterIntakeCups} cups/day` : "Not provided"}
- Allergies: ${input.allergies?.trim() || "Not provided"}
- Conditions: ${input.conditions?.trim() || "Not provided"}
- Medications: ${input.medications?.trim() || "Not provided"}
- Current supplements: ${input.supplements?.trim() || "Not provided"}
- Top priorities: ${input.topPriorities?.trim() || "Not provided"}

Requirements:
- Keep language plain and supportive.
- Do not diagnose disease.
- Mention what looks good and what to monitor.
- Include one clear action for today.
- Return strict JSON with keys: summary, motivation.
- summary: 2-4 short sentences.
- motivation: 1 short encouraging sentence.

${getLanguageInstruction(language)}`;

  try {
    const response = await createChatCompletion({
      model: ANALYSIS_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a supportive health coach. You provide cautious non-diagnostic wellness guidance from profile data. Always return valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 220
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const parsed = JSON.parse(content) as Partial<DailyProfileSummary>;
    const result: DailyProfileSummary = {
      summary: parsed.summary?.trim() || "Your profile looks stable today. Keep tracking your metrics and stay consistent with your plan.",
      motivation: parsed.motivation?.trim() || "Small consistent actions today will build stronger results over time."
    };
    const localized = await translateDailyProfileSummary(result, language);

    if (typeof window !== "undefined") {
      try {
        persistentStorage.setItem(cacheKey, JSON.stringify(localized));
      } catch {
        // Ignore storage errors.
      }
    }
    return localized;
  } catch (error) {
    console.error("Error generating profile summary:", error);
    throw new Error("Failed to generate profile summary.");
  }
}
