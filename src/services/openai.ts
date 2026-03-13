import { AVAILABLE_SUPPLEMENTS } from "../data/supplements";
import { pdfToImages, extractTextFromPdf } from "../utils/pdfProcessor";
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

const ANALYSIS_CACHE_VERSION = "v4";
const ANALYSIS_TEMPERATURE = 0;
const LANGUAGE_STORAGE_KEY = "appLanguage";

const ANALYSIS_MODEL = "gpt-4o";

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
}

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
5. Detailed insights by health category (focus on abnormal values; avoid listing all normal markers)

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
    const images = await pdfToImages(file);

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

Before giving recommendations, confirm you checked common lipid/metabolic markers if present: LDL, HDL, total cholesterol, triglycerides (TG), non-HDL, ApoB, glucose, HbA1c. If any of these are missing from the report, explicitly note them as "missing/unreported".

Before giving recommendations, confirm you checked common lipid/metabolic markers if present: LDL, HDL, total cholesterol, triglycerides (TG), non-HDL, ApoB, glucose, HbA1c. If any of these are missing from the report, explicitly note them as "missing/unreported".

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
                url: `data:image/jpeg;base64,${pageImage}`
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
    const normalized = normalizeRecommendations(analysis);
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

  // Determine the image format - ensure it's a supported format
  let imageFormat = fileType;
  if (fileType.includes('jpeg') || fileType.includes('jpg')) {
    imageFormat = 'image/jpeg';
  } else if (fileType.includes('png')) {
    imageFormat = 'image/png';
  } else if (fileType.includes('gif')) {
    imageFormat = 'image/gif';
  } else if (fileType.includes('webp')) {
    imageFormat = 'image/webp';
  } else {
    // Default to jpeg if unknown
    imageFormat = 'image/jpeg';
  }

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
              text: `Analyze this bloodwork report image and extract all biomarker values with their units and reference ranges.

AVAILABLE NUTRITION PRODUCTS:
${supplementsList}

Please provide:
1. A brief summary of the overall health status
2. Key concerns or areas that need attention (ONLY values outside reference ranges)
3. Positive findings or strengths (ONLY values clearly within healthy ranges)
4. Specific nutrition recommendations from our list that would address any deficiencies or support optimal health
5. Detailed insights by health category (focus on abnormal values; avoid listing all normal markers)

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
                url: `data:${imageFormat};base64,${base64Image}`
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
    const normalized = normalizeRecommendations(analysis);
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
    let imageFormat = img.fileType;
    if (imageFormat.includes("jpeg") || imageFormat.includes("jpg")) {
      imageFormat = "image/jpeg";
    } else if (imageFormat.includes("png")) {
      imageFormat = "image/png";
    } else if (imageFormat.includes("gif")) {
      imageFormat = "image/gif";
    } else if (imageFormat.includes("webp")) {
      imageFormat = "image/webp";
    } else {
      imageFormat = "image/jpeg";
    }
    return {
      type: "image_url" as const,
      image_url: { url: `data:${imageFormat};base64,${img.base64}` }
    };
  });

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
5. Detailed insights by health category (focus on abnormal values; avoid listing all normal markers)

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
    const normalized = normalizeRecommendations(analysis);
    const localized = await localizeBloodworkAnalysis(normalized, language);
    setCachedAnalysis(cacheKey, localized);
    return localized;
  } catch (error) {
    console.error("Error analyzing bloodwork images:", error);
    throw new Error("Failed to analyze bloodwork images. Please ensure the images are clear and contain bloodwork data.");
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
  weightKg?: number;
  bloodPressure?: string;
  fastingGlucoseMgDl?: number;
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

const getCurrentLanguage = (): Language => {
  const stored = persistentStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === "zh" ? "zh" : "en";
};

const getLanguageInstruction = (language: Language): string =>
  language === "zh"
    ? "Respond entirely in Simplified Chinese. Keep supplementName and supplementId unchanged."
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
- Weight: ${input.weightKg && input.weightKg > 0 ? `${input.weightKg} kg` : "Not provided"}
- Blood pressure: ${input.bloodPressure?.trim() || "Not provided"}
- Fasting glucose: ${input.fastingGlucoseMgDl && input.fastingGlucoseMgDl > 0 ? `${input.fastingGlucoseMgDl} mg/dL` : "Not provided"}

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
