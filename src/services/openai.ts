import OpenAI from "openai";
import { AVAILABLE_SUPPLEMENTS } from "../data/supplements";
import { pdfToImages, extractTextFromPdf } from "../utils/pdfProcessor";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Note: In production, API calls should go through a backend
});

const ANALYSIS_CACHE_VERSION = "v1";
const ANALYSIS_TEMPERATURE = 0;

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
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return null;
    return JSON.parse(raw) as BloodworkAnalysis;
  } catch {
    return null;
  }
};

const setCachedAnalysis = (cacheKey: string, analysis: BloodworkAnalysis) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(analysis));
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
 * Analyzes bloodwork data using OpenAI and recommends supplements
 */
export async function analyzeBloodwork(
  bloodworkData: BloodworkData
): Promise<BloodworkAnalysis> {
  const cacheKey = buildAnalysisCacheKey("bloodwork", {
    bloodworkData,
    supplementIds: AVAILABLE_SUPPLEMENTS.map((s) => s.id)
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

  const prompt = `You are a health and nutrition expert analyzing bloodwork results. Based on the following bloodwork data, provide personalized supplement recommendations from our available products.

BLOODWORK DATA:
${bloodworkSummary}

AVAILABLE SUPPLEMENTS:
${supplementsList}

Please analyze the bloodwork and provide:
1. A brief summary of the overall health status
2. Key concerns or areas that need attention (ONLY values outside reference ranges)
3. Positive findings or strengths (ONLY values clearly within healthy ranges)
4. Specific supplement recommendations from our list that would address any deficiencies or support optimal health
5. Detailed insights by health category (focus on abnormal values; avoid listing all normal markers)

Only recommend items from AVAILABLE SUPPLEMENTS. Do NOT recommend branded blends (e.g., Just Slim, Just Mushroom) or anything not listed.
Recommendations must be between 3 and 8 items. Increase the number of recommendations when there are multiple or severe deficiencies. Each supplementName must exactly match a name from AVAILABLE SUPPLEMENTS.
Each recommendation MUST cite the specific abnormal biomarker(s) and their values/ranges that justify it. Do not recommend anything without a clear, abnormal biomarker-based reason. Do not include generic or default supplements.

IMPORTANT: For dosage recommendations, provide ACCURATE daily intake amounts based on scientific evidence and the severity of deficiency. Only use the guidance below for supplements you already decided to recommend; do NOT use it to choose supplements:
- Spirulina: 3-5g per day (1 teaspoon = ~3g)
- Chlorella: 2-3g per day
- Wheatgrass: 3-5g per day (1 teaspoon)
- Moringa: 2-3g per day
- Turmeric: 1-3g per day (500mg-1g for mild support, 2-3g for significant inflammation)
- Ashwagandha: 300-600mg per day (0.3-0.6g)
- Maca Root: 3-5g per day
- Beetroot: 5-10g per day
- Matcha: 1-2g per day (1/2 to 1 teaspoon)
- Cacao: 5-10g per day (1-2 teaspoons)
- Chia Seeds: 1-2 tablespoons per day (15-30g)
- Flax Seeds: 1-2 tablespoons per day (ground)
- Hemp Seeds: 2-3 tablespoons per day (30-45g)
- Goji Berries: 10-30g per day (1-3 tablespoons)
- Acai: 5-10g per day (powder)
- Mushroom blends: 1-3g per day depending on type
- Collagen: 10-20g per day
- Protein powders: 20-30g per day

ADJUST dosages based on:
- Severity of deficiency (higher for severe deficiencies)
- Multiple deficiencies (may need higher amounts)
- Age, weight, and health status
- Specific biomarker levels

Do NOT use generic "5g per day" for everything - be specific and evidence-based!

Respond in JSON format with this structure:
{
  "summary": "Brief overall health summary",
  "concerns": ["concern 1", "concern 2"],
  "strengths": ["strength 1", "strength 2"],
  "recommendations": [
    {
      "supplementId": "supplement-id",
      "supplementName": "Supplement Name",
      "reason": "Why this supplement is recommended based on specific bloodwork values",
      "priority": "high|medium|low",
      "dosage": "Accurate daily intake amount based on guidelines above"
    }
  ],
  "detailedInsights": [
    {
      "category": "Category name",
      "findings": "What the bloodwork shows",
      "impact": "What this means for health"
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a knowledgeable health and nutrition expert who analyzes bloodwork and provides evidence-based supplement recommendations with ACCURATE dosages that vary based on the specific supplement and severity of deficiencies. Use plain, non-medical language for concerns, strengths, and detailed insights so a layperson can understand. Always respond with valid JSON."
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
    setCachedAnalysis(cacheKey, normalized);
    return normalized;
  } catch (error) {
    console.error("Error analyzing bloodwork:", error);
    throw new Error("Failed to analyze bloodwork. Please try again.");
  }
}

/**
 * Analyzes bloodwork from a PDF file by converting it to images
 */
export async function analyzeBloodworkPdf(file: File): Promise<BloodworkAnalysis> {
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

    // For now, analyze only the first page (most bloodwork reports have results on first page)
    // In the future, we could analyze all pages and combine results
    const firstPageImage = images[0];

    const cacheKey = buildAnalysisCacheKey("pdf", {
      pdfFingerprint,
      firstPageImageHash: hashString(firstPageImage),
      supplementIds: AVAILABLE_SUPPLEMENTS.map((s) => s.id)
    });
    const cached = getCachedAnalysis(cacheKey);
    if (cached) {
      return cached;
    }

    const response = await openai.chat.completions.create({
      model: ANALYSIS_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a health and nutrition expert who analyzes bloodwork reports. Extract all biomarker values, compare them to reference ranges, and provide personalized supplement recommendations with ACCURATE, evidence-based dosages. Adjust dosages based on the severity of deficiencies shown in the bloodwork. Use plain, non-medical language for concerns, strengths, and detailed insights so a layperson can understand. Always respond with valid JSON."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this bloodwork report (converted from PDF) and extract all biomarker values with their units and reference ranges.

AVAILABLE SUPPLEMENTS:
${supplementsList}

Please provide:
1. A brief summary of the overall health status
2. Key concerns or areas that need attention (ONLY values outside reference ranges)
3. Positive findings or strengths (ONLY values clearly within healthy ranges)
4. Specific supplement recommendations from our list that would address any deficiencies or support optimal health
5. Detailed insights by health category (focus on abnormal values; avoid listing all normal markers)

Use layman-friendly language (avoid medical jargon, define any necessary terms).

Only recommend items from AVAILABLE SUPPLEMENTS. Do NOT recommend branded blends (e.g., Just Slim, Just Mushroom) or anything not listed.
Recommendations must be between 3 and 8 items. Increase the number of recommendations when there are multiple or severe deficiencies. Each supplementName must exactly match a name from AVAILABLE SUPPLEMENTS.
Each recommendation MUST cite the specific abnormal biomarker(s) and their values/ranges that justify it. Do not recommend anything without a clear, abnormal biomarker-based reason. Do not include generic or default supplements.

IMPORTANT: For dosage recommendations, provide ACCURATE daily intake amounts based on scientific evidence and the severity of deficiency. Only use the guidance below for supplements you already decided to recommend; do NOT use it to choose supplements:
- Spirulina: 3-5g per day (1 teaspoon = ~3g)
- Chlorella: 2-3g per day
- Wheatgrass: 3-5g per day (1 teaspoon)
- Moringa: 2-3g per day
- Turmeric: 1-3g per day (500mg-1g for mild support, 2-3g for significant inflammation)
- Ashwagandha: 300-600mg per day (0.3-0.6g)
- Maca Root: 3-5g per day
- Beetroot: 5-10g per day
- Matcha: 1-2g per day (1/2 to 1 teaspoon)
- Cacao: 5-10g per day (1-2 teaspoons)
- Chia Seeds: 1-2 tablespoons per day (15-30g)
- Flax Seeds: 1-2 tablespoons per day (ground)
- Hemp Seeds: 2-3 tablespoons per day (30-45g)
- Goji Berries: 10-30g per day (1-3 tablespoons)
- Acai: 5-10g per day (powder)
- Mushroom blends: 1-3g per day depending on type
- Collagen: 10-20g per day
- Protein powders: 20-30g per day

ADJUST dosages based on:
- Severity of deficiency (higher for severe deficiencies)
- Multiple deficiencies (may need higher amounts)
- Age, weight, and health status
- Specific biomarker levels

Do NOT use generic "5g per day" for everything - be specific and evidence-based!

Respond in JSON format with this structure:
{
  "summary": "Brief overall health summary",
  "concerns": ["concern 1", "concern 2"],
  "strengths": ["strength 1", "strength 2"],
  "recommendations": [
    {
      "supplementId": "supplement-id",
      "supplementName": "Supplement Name",
      "reason": "Why this supplement is recommended based on the bloodwork",
      "priority": "high|medium|low",
      "dosage": "Daily intake amount (e.g., '5g per day' or '1 tablespoon per day' for chia seeds)"
    }
  ],
  "detailedInsights": [
    {
      "category": "Category name (e.g., Cardiovascular, Immune System)",
      "findings": "What the bloodwork shows",
      "impact": "What this means for health"
    }
  ]
}`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${firstPageImage}`
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
    setCachedAnalysis(cacheKey, normalized);
    return normalized;
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
  const cacheKey = buildAnalysisCacheKey("image", {
    imageHash: hashString(base64Image),
    fileType,
    supplementIds: AVAILABLE_SUPPLEMENTS.map((s) => s.id)
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
    const response = await openai.chat.completions.create({
      model: ANALYSIS_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a health and nutrition expert who analyzes bloodwork reports. Extract all biomarker values, compare them to reference ranges, and provide personalized supplement recommendations with ACCURATE, evidence-based dosages. Adjust dosages based on the severity of deficiencies shown in the bloodwork. Use plain, non-medical language for concerns, strengths, and detailed insights so a layperson can understand. Always respond with valid JSON."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this bloodwork report image and extract all biomarker values with their units and reference ranges.

AVAILABLE SUPPLEMENTS:
${supplementsList}

Please provide:
1. A brief summary of the overall health status
2. Key concerns or areas that need attention (ONLY values outside reference ranges)
3. Positive findings or strengths (ONLY values clearly within healthy ranges)
4. Specific supplement recommendations from our list that would address any deficiencies or support optimal health
5. Detailed insights by health category (focus on abnormal values; avoid listing all normal markers)

Use layman-friendly language (avoid medical jargon, define any necessary terms).

Only recommend items from AVAILABLE SUPPLEMENTS. Do NOT recommend branded blends (e.g., Just Slim, Just Mushroom) or anything not listed.
Recommendations must be between 3 and 8 items. Increase the number of recommendations when there are multiple or severe deficiencies. Each supplementName must exactly match a name from AVAILABLE SUPPLEMENTS.
Each recommendation MUST cite the specific abnormal biomarker(s) and their values/ranges that justify it. Do not recommend anything without a clear, abnormal biomarker-based reason. Do not include generic or default supplements.

IMPORTANT: For dosage recommendations, provide ACCURATE daily intake amounts based on scientific evidence and the severity of deficiency. Only use the guidance below for supplements you already decided to recommend; do NOT use it to choose supplements:
- Spirulina: 3-5g per day (1 teaspoon = ~3g)
- Chlorella: 2-3g per day
- Wheatgrass: 3-5g per day (1 teaspoon)
- Moringa: 2-3g per day
- Turmeric: 1-3g per day (500mg-1g for mild support, 2-3g for significant inflammation)
- Ashwagandha: 300-600mg per day (0.3-0.6g)
- Maca Root: 3-5g per day
- Beetroot: 5-10g per day
- Matcha: 1-2g per day (1/2 to 1 teaspoon)
- Cacao: 5-10g per day (1-2 teaspoons)
- Chia Seeds: 1-2 tablespoons per day (15-30g)
- Flax Seeds: 1-2 tablespoons per day (ground)
- Hemp Seeds: 2-3 tablespoons per day (30-45g)
- Goji Berries: 10-30g per day (1-3 tablespoons)
- Acai: 5-10g per day (powder)
- Mushroom blends: 1-3g per day depending on type
- Collagen: 10-20g per day
- Protein powders: 20-30g per day

ADJUST dosages based on:
- Severity of deficiency (higher for severe deficiencies)
- Multiple deficiencies (may need higher amounts)
- Age, weight, and health status
- Specific biomarker levels

Do NOT use generic "5g per day" for everything - be specific and evidence-based!

Respond in JSON format with this structure:
{
  "summary": "Brief overall health summary",
  "concerns": ["concern 1", "concern 2"],
  "strengths": ["strength 1", "strength 2"],
  "recommendations": [
    {
      "supplementId": "supplement-id",
      "supplementName": "Supplement Name",
      "reason": "Why this supplement is recommended based on the bloodwork",
      "priority": "high|medium|low",
      "dosage": "Daily intake amount (e.g., '5g per day' or '1 tablespoon per day' for chia seeds)"
    }
  ],
  "detailedInsights": [
    {
      "category": "Category name (e.g., Cardiovascular, Immune System)",
      "findings": "What the bloodwork shows",
      "impact": "What this means for health"
    }
  ]
}`
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
    setCachedAnalysis(cacheKey, normalized);
    return normalized;
  } catch (error) {
    console.error("Error analyzing bloodwork file:", error);
    throw new Error("Failed to analyze bloodwork file. Please ensure the image is clear and contains bloodwork data.");
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
    const response = await openai.chat.completions.create({
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
