import type { SupplementRecommendation } from "../services/openai";

export const CUSTOM_BLEND_SERVING_GRAMS = 10;
export const ACTIVE_BLEND_GRAMS = 2;

const PROTEIN_BASE_IDS = ["pea-protein-original", "pea-protein-cacao"];
const OAT_BASE_ID = "australian-instant-oats";

const DEFAULT_PROTEIN_BASE = {
  supplementId: "pea-protein-original",
  supplementName: "Pea Protein Original"
};

const DEFAULT_OAT_BASE = {
  supplementId: OAT_BASE_ID,
  supplementName: "Australian Instant Oats"
};

const roundGrams = (grams: number) => Number(grams.toFixed(2));

export const isProteinBaseRecommendation = (recommendation: Pick<SupplementRecommendation, "supplementId">) =>
  PROTEIN_BASE_IDS.includes(recommendation.supplementId);

export const isOatBaseRecommendation = (recommendation: Pick<SupplementRecommendation, "supplementId">) =>
  recommendation.supplementId === OAT_BASE_ID;

export const isBaseRecommendation = (recommendation: Pick<SupplementRecommendation, "supplementId">) =>
  isProteinBaseRecommendation(recommendation) || isOatBaseRecommendation(recommendation);

export const getCustomBlendPlan = (recommendations: SupplementRecommendation[]) => {
  const proteinBase =
    recommendations.find(isProteinBaseRecommendation) ||
    DEFAULT_PROTEIN_BASE;
  const oatBase =
    recommendations.find(isOatBaseRecommendation) ||
    DEFAULT_OAT_BASE;
  const activeRecommendations = recommendations.filter((recommendation) => !isBaseRecommendation(recommendation));
  const activeTotalGrams = activeRecommendations.length * ACTIVE_BLEND_GRAMS;
  const baseTotalGrams = Math.max(CUSTOM_BLEND_SERVING_GRAMS - activeTotalGrams, 0);
  const proteinBaseGrams = roundGrams(baseTotalGrams / 2);
  const oatBaseGrams = roundGrams(baseTotalGrams - proteinBaseGrams);
  const gramsBySupplementId = new Map<string, number>();

  recommendations.forEach((recommendation) => {
    if (isProteinBaseRecommendation(recommendation)) {
      gramsBySupplementId.set(recommendation.supplementId, proteinBaseGrams);
      return;
    }

    if (isOatBaseRecommendation(recommendation)) {
      gramsBySupplementId.set(recommendation.supplementId, oatBaseGrams);
      return;
    }

    gramsBySupplementId.set(recommendation.supplementId, ACTIVE_BLEND_GRAMS);
  });

  return {
    activeRecommendations,
    baseTotalGrams,
    proteinBase,
    proteinBaseGrams,
    oatBase,
    oatBaseGrams,
    gramsBySupplementId
  };
};

export const ensureCustomBlendBaseRecommendations = (recommendations: SupplementRecommendation[]) => {
  const hasProteinBase = recommendations.some(isProteinBaseRecommendation);
  const hasOatBase = recommendations.some(isOatBaseRecommendation);
  const baseRecommendations: SupplementRecommendation[] = [];

  if (!hasProteinBase) {
    baseRecommendations.push({
      ...DEFAULT_PROTEIN_BASE,
      priority: "low",
      reason: "Base blend protein for the custom serving."
    });
  }

  if (!hasOatBase) {
    baseRecommendations.push({
      ...DEFAULT_OAT_BASE,
      priority: "low",
      reason: "Base blend oats for the custom serving."
    });
  }

  return [...recommendations, ...baseRecommendations];
};

export const withCustomBlendDosages = (recommendations: SupplementRecommendation[]) => {
  const recommendationsWithBases = ensureCustomBlendBaseRecommendations(recommendations);
  const blendPlan = getCustomBlendPlan(recommendationsWithBases);

  return recommendationsWithBases.map((recommendation) => {
    const grams = blendPlan.gramsBySupplementId.get(recommendation.supplementId) ?? ACTIVE_BLEND_GRAMS;

    return {
      ...recommendation,
      dosage: `${grams} g per serving size`,
      dosageGramsPerDay: grams
    };
  });
};
