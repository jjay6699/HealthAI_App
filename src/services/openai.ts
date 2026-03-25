import { AVAILABLE_SUPPLEMENTS } from "../data/supplements";
import { SUPPLEMENT_DESCRIPTIONS } from "../data/supplementDescriptions";
import { pdfToImages, extractStructuredTextPagesFromPdf, extractTextFromPdf } from "../utils/pdfProcessor";
import { extractStructuredTextFromImage } from "../utils/imageOcr";
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

const ANALYSIS_CACHE_VERSION = "v28";
const ANALYSIS_TEMPERATURE = 0;
const LANGUAGE_STORAGE_KEY = "appLanguage";

const ANALYSIS_MODEL = "gpt-4o";

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
  parsingDebug?: {
    rawRowCount: number;
    finalRowCount: number;
    derivedMarkerIds?: string[];
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
  "Total WBC Count",
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
  { marker: "RDW (CV)", patterns: [/^rdw\s*\(cv\)\b/i, /^rdw value\b/i, /^rdw\b/i] },
  { marker: "Total WBC Count", patterns: [/^total wbc count\b/i, /^wbc count\b/i, /^wbc\b/i, /^tlc\b/i, /^total leucocyte count\b/i, /^total leukocyte count\b/i] },
  { marker: "Neutrophils", patterns: [/^neutrophils?\b/i, /^polymorphs\b/i] },
  { marker: "Lymphocytes", patterns: [/^lymphocytes?\b/i] },
  { marker: "Monocytes", patterns: [/^monocytes?\b/i] },
  { marker: "Eosinophils", patterns: [/^eosinophils?\b/i] },
  { marker: "Basophils", patterns: [/^basophils?\b/i] },
  { marker: "Absolute Neutrophil Count (ANC)", patterns: [/^absolute neutrophil count\s*\(anc\)\b/i, /^absolute neutrophil count\b/i] },
  { marker: "Absolute Lymphocyte Count (ALC)", patterns: [/^absolute lymphocyte count\s*\(alc\)\b/i, /^absolute lymphocyte count\b/i] },
  { marker: "Absolute Monocyte Count", patterns: [/^absolute monocyte count\b/i] },
  { marker: "Absolute Eosinophil Count (AEC)", patterns: [/^absolute eosinophil count\s*\(aec\)\b/i, /^absolute eosinophil count\b/i] },
  { marker: "Absolute Basophil Count", patterns: [/^absolute basophil count\b/i, /^absolute basophils count\b/i, /^absolute basophils\b/i] },
  { marker: "Platelets Count", patterns: [/^platelets count\b/i, /^platelet count\b/i, /^platelet\b/i] }
];

const PANEL_PATTERNS = [
  /lipid studies/i,
  /liver function test/i,
  /hematology/i,
  /complete blood picture/i,
  /complete blood count/i,
  /renal function/i,
  /thyroid/i,
  /urinalysis/i
];

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
  if (!row.value) return true;

  const normalizedValue = normalizeForMatch(row.value);
  return matchingLineIndexes.some((index) => {
    const window = reportLines.slice(Math.max(0, index - 1), Math.min(reportLines.length, index + 2));
    return window.some((line) => line.includes(normalizedValue));
  });
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

const finalizeParsedRows = (rows: ExtractedReportRow[]): ParsedReportRow[] => {
  const deduped = new Map<string, ParsedReportRow>();
  const sourceRows = [...rows];

  for (const row of sourceRows) {
    if (row.status === "comment") {
      continue;
    }

    const marker = canonicalizeMarkerName(row.marker || "");
    if (!marker) continue;
    const markerId = getCanonicalMarkerId(marker);

    const normalizedPanel = row.panel?.trim() || undefined;
    const normalizedValue = row.value?.trim() || undefined;
    const normalizedUnit = row.unit?.trim() || undefined;
    const normalizedRange = row.referenceRange?.trim() || undefined;
    const normalizedNote = row.note?.trim() || undefined;
    const status = inferRowStatus(row) || "unknown";

    const parsedRow: ParsedReportRow = {
      markerId,
      panel: normalizedPanel,
      marker,
      value: normalizedValue,
      unit: normalizedUnit,
      referenceRange: normalizedRange,
      status,
      note: normalizedNote,
      explanation: row.whyItMatters?.trim() || undefined
    };

    const key = [
      markerId,
      status === "comment" ? normalizedNote || "" : ""
    ].join("|");

    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, parsedRow);
      continue;
    }

    const existingScore =
      (existing.value ? 4 : 0) +
      (existing.referenceRange ? 3 : 0) +
      (existing.status !== "unknown" ? 2 : 0) +
      (existing.note ? 1 : 0);
    const parsedScore =
      (parsedRow.value ? 4 : 0) +
      (parsedRow.referenceRange ? 3 : 0) +
      (parsedRow.status !== "unknown" ? 2 : 0) +
      (parsedRow.note ? 1 : 0);

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

  return [...deduped.values()];
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

  const commentMatch = trimmed.match(/^(note|comments?|blood picture|wbcs|platelet-count)\s*:?\s*(.*)$/i);
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
    whyItMatters: undefined
  };
};

const parseStructuredTextLines = (lines: string[]): ExtractedReportRow[] => {
  const rows: ExtractedReportRow[] = [];
  let currentPanel: string | undefined;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (PANEL_PATTERNS.some((pattern) => pattern.test(line))) {
      currentPanel = line;
      continue;
    }

    if (/^(test name|result|unit|reference range|investigation|observed value|biological ref range|method)\b/i.test(line)) {
      continue;
    }

    const parsed = parseStructuredLineRow(line, currentPanel);
    if (parsed) {
      rows.push(parsed);
    }
  }

  return rows;
};

const parseStructuredPdfRows = (pages: { text: string }[]): ExtractedReportRow[] => {
  const rows: ExtractedReportRow[] = [];

  for (const page of pages) {
    const lines = page.text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    rows.push(...parseStructuredTextLines(lines));
  }

  return rows;
};

const extractImageOcrBundle = async (
  images: { base64: string; fileType: string; label: string }[]
) => {
  const blocks: string[] = [];
  const rows: ExtractedReportRow[] = [];

  for (const image of images) {
    try {
      const ocr = await extractStructuredTextFromImage(
        image.base64,
        normalizeImageMimeType(image.fileType)
      );
      if (ocr.text) {
        blocks.push(`Document: ${image.label}\nType: Image health report\nOCR text:\n${ocr.text}`);
      }
      rows.push(...parseStructuredTextLines(ocr.lines));
    } catch (error) {
      console.warn("Image OCR failed:", image.label, error);
    }
  }

  return { blocks, rows };
};

const mergeAnalysisWithParsedRows = (
  analysis: BloodworkAnalysis,
  rows: ExtractedReportRow[]
): BloodworkAnalysis => {
  const parsedRows = finalizeParsedRows(rows);
  if (parsedRows.length === 0) {
    return analysis;
  }

  const deterministic = buildDeterministicFindings(parsedRows);

  return {
    ...analysis,
    concerns: deterministic.concerns,
    strengths: deterministic.strengths.slice(0, 8),
    detailedInsights: deterministic.detailedInsights,
    parsedRows,
    parsingDebug: {
      rawRowCount: rows.length,
      finalRowCount: parsedRows.length,
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
  language: Language
): Promise<ExtractedReportRow[]> => {
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
      rowHasExplicitTextEvidence(reportContent, row)
  );
};

const extractExpectedMarkers = async (
  reportContent: unknown,
  language: Language,
  expectedMarkers: readonly string[]
): Promise<ExtractedReportRow[]> => {
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
      rowHasExplicitTextEvidence(reportContent, row)
  );
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
  const cached = getCachedAnalysis(cacheKey);
  if (cached) {
    return cached;
  }

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
    setCachedAnalysis(cacheKey, localized);
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
  const cached = getCachedAnalysis(cacheKey);
  if (cached) {
    return cached;
  }

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
    setCachedAnalysis(cacheKey, localized);
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

  // Analyze all pages for full coverage
  const allPages = images;

    const cacheKey = buildAnalysisCacheKey("pdf", {
      pdfFingerprint,
      pageImageHashes: allPages.map((img) => hashString(img)),
      supplementIds: AVAILABLE_SUPPLEMENTS.map((s) => s.id),
      language
    });
    const cached = getCachedAnalysis(cacheKey);
    if (cached) {
      return cached;
    }

    const verificationReportContent = [
      {
        type: "text" as const,
        text: `PDF bloodwork report for verification.\n\nOCR text:\n${extractedPdfText || "No OCR text available"}`
      },
      ...allPages.map((pageImage) => ({
        type: "image_url" as const,
        image_url: {
          url: `data:image/jpeg;base64,${pageImage}`,
          detail: "high" as const
        }
      }))
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
    const deterministicRows = parseStructuredPdfRows(structuredPages);
    const extractedRows = await extractStructuredReportRows(verificationReportContent, language).catch(() => []);
    const completedRows = [...deterministicRows, ...extractedRows];
    const normalized = normalizeRecommendations(
      mergeAnalysisWithParsedRows(analysis, completedRows)
    );
    const localized = await localizeBloodworkAnalysis(normalized, language);
    setCachedAnalysis(cacheKey, localized);
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
  const cached = getCachedAnalysis(cacheKey);
  if (cached) {
    return cached;
  }

  const supplementsList = AVAILABLE_SUPPLEMENTS.map(
    (s) => `${s.id}: ${s.name} - Benefits: ${s.benefits.join(", ")} - Key Nutrients: ${s.keyNutrients.join(", ")}`
  ).join("\n");

  const imageFormat = normalizeImageMimeType(fileType);

  try {
    const imageOcr = await extractImageOcrBundle([
      { base64: base64Image, fileType: imageFormat, label: "Uploaded image" }
    ]);
    const verificationReportContent = [
      {
        type: "text" as const,
        text: `Single bloodwork report image for abnormal-marker verification.

${imageOcr.blocks.join("\n\n") || "OCR text unavailable."}`
      },
      {
        type: "image_url" as const,
        image_url: {
          url: `data:${imageFormat};base64,${base64Image}`,
          detail: "high" as const
        }
      }
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
            {
              type: "image_url",
              image_url: {
                url: `data:${imageFormat};base64,${base64Image}`,
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
    const extractedRows = await extractStructuredReportRows(verificationReportContent, language).catch(() => []);
    const completedRows = [...imageOcr.rows, ...extractedRows];
    const normalized = normalizeRecommendations(
      mergeAnalysisWithParsedRows(analysis, completedRows)
    );
    const localized = await localizeBloodworkAnalysis(normalized, language);
    setCachedAnalysis(cacheKey, localized);
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
  const language = getCurrentLanguage();
  const cacheKey = buildAnalysisCacheKey("images", {
    imageHashes: images.map((img) => hashString(img.base64)),
    fileTypes: images.map((img) => img.fileType),
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

  const imageParts = images.map((img) => {
    const imageFormat = normalizeImageMimeType(img.fileType);
    return {
      type: "image_url" as const,
      image_url: { url: `data:${imageFormat};base64,${img.base64}`, detail: "high" }
    };
  });
  const imageOcr = await extractImageOcrBundle(
    images.map((img, index) => ({
      base64: img.base64,
      fileType: img.fileType,
      label: `Uploaded image ${index + 1}`
    }))
  );

  const verificationReportContent = [
    {
      type: "text" as const,
      text: `Multi-image bloodwork report for abnormal-marker verification.

${imageOcr.blocks.join("\n\n") || "OCR text unavailable."}`
    },
    ...imageParts
  ];

  try {
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
              text: `Analyze these bloodwork report images and extract all biomarker values with their units and reference ranges.

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
Base blend rule: include exactly one protein base (Pea Protein Original OR Pea Protein Cacao) and exactly one fiber base (Australian Instant Oats OR Organic Psyllium Husk) as part of the recommendations, unless contraindicated by the bloodwork or user sensitivities.

IMPORTANT: For dosage recommendations, provide ACCURATE daily intake amounts based on scientific evidence and the severity of deficiency. Only use the guidance below for nutrition products you already decided to recommend; do NOT use it to choose nutrition products.
Use grams only (e.g., "3 g per serving size"). Do NOT use tablespoons/teaspoons or capsules in the dosage string.
Also include numeric field dosageGramsPerDay (number of grams per serving size).
Ensure the total daily grams across all recommended nutrition products sums to 10 g per serving size (2 tbsp total blend).

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
            ...imageParts
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
    const extractedRows = await extractStructuredReportRows(verificationReportContent, language).catch(() => []);
    const completedRows = [...imageOcr.rows, ...extractedRows];
    const normalized = normalizeRecommendations(
      mergeAnalysisWithParsedRows(analysis, completedRows)
    );
    const localized = await localizeBloodworkAnalysis(normalized, language);
    setCachedAnalysis(cacheKey, localized);
    return localized;
  } catch (error) {
    console.error("Error analyzing bloodwork images:", error);
    throw new Error("Failed to analyze bloodwork images. Please ensure the images are clear and contain bloodwork data.");
  }
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

  for (const file of files) {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (isPdf) {
      const [pages, extractedText, structuredPages] = await Promise.all([
        pdfToImages(file),
        extractTextFromPdf(file).catch(() => ""),
        extractStructuredTextPagesFromPdf(file).catch(() => [])
      ]);

      deterministicRows.push(...parseStructuredPdfRows(structuredPages));
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
    const extractedRows = await extractStructuredReportRows(bundleContent, language).catch(() => []);
    const normalized = normalizeRecommendations(
      mergeAnalysisWithParsedRows(analysis, [...deterministicRows, ...extractedRows])
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
    temperature: 0
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
