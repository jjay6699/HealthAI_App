import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
import Card from "../../components/Card";
import Dialog from "../../components/Dialog";
import SectionHeader from "../../components/SectionHeader";
import { useI18n } from "../../i18n";
import { AppTheme, useTheme } from "../../theme";
import {
  BloodworkAnalysis,
  SupplementRecommendation,
  translateBloodworkAnalysis,
  translateSupplementContent
} from "../../services/openai";
import { AVAILABLE_SUPPLEMENTS, Supplement } from "../../data/supplements";
import { SUPPLEMENT_DESCRIPTIONS } from "../../data/supplementDescriptions";
import { persistentStorage } from "../../services/persistentStorage";
import { useAuth } from "../../services/auth";
import { fetchLatestBloodworkRecord } from "../../services/bloodworkApi";

type DisplaySupplementContent = {
  benefits: string[];
  keyNutrients: string[];
  description?: string;
};

const SupplementsScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { language, t } = useI18n();
  const isChinese = language === "zh";
  const isMalay = language === "bm";
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<SupplementRecommendation[]>([]);
  const [displayRecommendations, setDisplayRecommendations] = useState<SupplementRecommendation[]>([]);
  const [translatedContent, setTranslatedContent] = useState<Record<string, DisplaySupplementContent>>({});
  const [activeSupplementId, setActiveSupplementId] = useState<string | null>(null);
  const [hasHydratedRecommendations, setHasHydratedRecommendations] = useState(false);
  const [isRecommendationsLoading, setIsRecommendationsLoading] = useState(true);

  const scopedKey = (baseKey: string) => (user?.id ? `${baseKey}:${user.id}` : baseKey);

  useEffect(() => {
    let cancelled = false;

    const loadRecommendations = async () => {
      const storedAnalysis =
        persistentStorage.getItem(scopedKey("bloodworkAnalysis")) ??
        persistentStorage.getItem("bloodworkAnalysis");
      let localRecommendations: SupplementRecommendation[] = [];

      if (storedAnalysis) {
        try {
          const analysis: BloodworkAnalysis = JSON.parse(storedAnalysis);
          localRecommendations = analysis.recommendations || [];
        } catch (error) {
          console.error("Failed to parse bloodwork analysis:", error);
        }
      }

      try {
        const record = await fetchLatestBloodworkRecord();
        if (cancelled) return;

        if (record) {
          setRecommendations(record.analysis.recommendations || []);
          persistentStorage.setItem(
            scopedKey("bloodworkAnalysis"),
            JSON.stringify(record.analysis)
          );
        } else {
          setRecommendations(localRecommendations);
        }
      } catch (error) {
        console.error("Failed to load remote bloodwork analysis:", error);
        if (!cancelled) {
          setRecommendations(localRecommendations);
        }
      } finally {
        if (!cancelled) {
          setHasHydratedRecommendations(true);
        }
      }
    };

    void loadRecommendations();
  }, [user?.id]);

  useEffect(() => {
    if (!hasHydratedRecommendations) return;
    let cancelled = false;
    setIsRecommendationsLoading(true);

    const run = async () => {
      if (recommendations.length === 0) {
        if (!cancelled) {
          setDisplayRecommendations([]);
          setIsRecommendationsLoading(false);
        }
        return;
      }

      const translated = await translateBloodworkAnalysis(
        {
          summary: "",
          concerns: [],
          strengths: [],
          recommendations,
          detailedInsights: []
        },
        language
      );

      if (!cancelled) {
        setDisplayRecommendations(translated.recommendations || []);
        setIsRecommendationsLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [hasHydratedRecommendations, language, recommendations]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (language === "en") {
        setTranslatedContent(
          Object.fromEntries(
            AVAILABLE_SUPPLEMENTS.map((supplement) => [
              supplement.id,
              {
                benefits: supplement.benefits,
                keyNutrients: supplement.keyNutrients,
                description: SUPPLEMENT_DESCRIPTIONS[supplement.id]
              }
            ])
          )
        );
        return;
      }

      const translatedEntries = await Promise.all(
        AVAILABLE_SUPPLEMENTS.map(async (supplement) => {
          const translated = await translateSupplementContent(
            {
              benefits: supplement.benefits,
              keyNutrients: supplement.keyNutrients,
              description: SUPPLEMENT_DESCRIPTIONS[supplement.id]
            },
            language
          );

          return [supplement.id, translated] as const;
        })
      );

      if (!cancelled) {
        setTranslatedContent(Object.fromEntries(translatedEntries));
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [language]);

  const getSupplementDetails = (supplementId: string): Supplement | undefined =>
    AVAILABLE_SUPPLEMENTS.find((supplement) => supplement.id === supplementId);

  const getPriorityBadgeTone = (priority: string): "success" | "warning" | "info" => {
    switch (priority) {
      case "high":
        return "warning";
      case "medium":
        return "info";
      default:
        return "success";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high":
        return t("supplements.priority.high");
      case "medium":
        return t("supplements.priority.medium");
      default:
        return t("supplements.priority.low");
    }
  };

  const parseDosageGrams = (dosage?: string) => {
    if (!dosage) return undefined;
    const matches = [...dosage.matchAll(/(\d+(\.\d+)?)\s*g/gi)].map((match) => Number(match[1]));
    if (matches.length === 0) return undefined;
    if (matches.length === 1) return matches[0];
    const sum = matches.reduce((accumulator, value) => accumulator + value, 0);
    return sum / matches.length;
  };

  const servingGrams = 10;
  const servingsPerBottle = 14;
  const servingsPerMonth = 28;
  const bottlesPerMonth = 2;
  const monthPrice = 85;

  const totalGrams = displayRecommendations.reduce((sum, recommendation) => {
    const grams = recommendation.dosageGramsPerDay ?? parseDosageGrams(recommendation.dosage);
    return grams ? sum + grams : sum;
  }, 0);

  const scaledGrams = displayRecommendations.map((recommendation) => {
    const grams = recommendation.dosageGramsPerDay ?? parseDosageGrams(recommendation.dosage);
    if (!grams || totalGrams === 0) {
      return { id: recommendation.supplementId, grams: undefined };
    }
    return {
      id: recommendation.supplementId,
      grams: Number(((grams / totalGrams) * servingGrams).toFixed(2))
    };
  });

  const getBaseSelections = () => {
    const proteinBases = ["Pea Protein Original", "Pea Protein Cacao"];
    const fiberBases = ["Australian Instant Oats", "Organic Psyllium Husk"];
    const protein = displayRecommendations.find((recommendation) => proteinBases.includes(recommendation.supplementName))?.supplementName;
    const fiber = displayRecommendations.find((recommendation) => fiberBases.includes(recommendation.supplementName))?.supplementName;
    return { protein, fiber };
  };

  const generateSummary = () => {
    const supplementNames = displayRecommendations.map((recommendation) => recommendation.supplementName).join(", ");
    const base = getBaseSelections();
    const baseText = base.protein && base.fiber
      ? t("supplements.baseBlend", { protein: base.protein, fiber: base.fiber })
      : "";
    const gramsText = t("supplements.servingBlend", { grams: servingGrams.toFixed(1) });

    return t("supplements.blendIncludes", {
      names: supplementNames,
      baseText,
      gramsText
    }).trim();
  };

  if (!hasHydratedRecommendations || isRecommendationsLoading) {
    return (
      <div style={styles.page}>
        <h1 style={styles.heading}>{t("supplements.heading")}</h1>
        <p style={styles.subheading}>{t("supplements.subheading")}</p>

        <Card style={styles.emptyCard}>
          <h3 style={styles.emptyTitle}>{isChinese ? "正在加载推荐..." : isMalay ? "Sedang memuatkan cadangan..." : "Loading recommendations..."}</h3>
          <p style={styles.emptyBody}>{isChinese ? "正在准备你的个性化营养方案。" : isMalay ? "Sedang menyediakan pelan suplemen peribadi anda." : "Preparing your personalized supplement plan."}</p>
        </Card>
      </div>
    );
  }

  if (displayRecommendations.length === 0) {
    return (
      <div style={styles.page}>
        <h1 style={styles.heading}>{t("supplements.emptyHeading")}</h1>
        <p style={styles.subheading}>{t("supplements.emptySubheading")}</p>

        <Card style={styles.emptyCard}>
          <h3 style={styles.emptyTitle}>{t("supplements.emptyTitle")}</h3>
          <p style={styles.emptyBody}>{t("supplements.emptyBody")}</p>
          <Link to="/upload">
            <Button title={t("supplements.uploadBloodwork")} fullWidth />
          </Link>
        </Card>

        <Card style={styles.notice} shadow={false}>
          <h3 style={styles.noticeTitle}>{t("supplements.collectionTitle")}</h3>
          <p style={styles.noticeBody}>{t("supplements.collectionBody", { count: AVAILABLE_SUPPLEMENTS.length })}</p>
        </Card>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>{t("supplements.heading")}</h1>
      <p style={styles.subheading}>{t("supplements.subheading")}</p>

      <Card style={styles.summaryCard}>
        <SectionHeader title={t("supplements.customBlend")} />
        <p style={styles.summaryText}>{generateSummary()}</p>
        <div style={styles.blendMeta}>
          <span>{t("supplements.servingSize", { grams: servingGrams })}</span>
          <span>{t("supplements.servingsBottleMonth", { perBottle: servingsPerBottle, perMonth: servingsPerMonth })}</span>
          <span>{t("supplements.bottlesPerMonth", { count: bottlesPerMonth })}</span>
        </div>
        <div style={styles.pricingRow}>
          <div>
            <p style={styles.priceLabel}>{t("supplements.monthlySupply")}</p>
            <p style={styles.priceAmount}>RM{monthPrice}</p>
            <p style={styles.priceSub}>{t("supplements.monthBundle", { count: bottlesPerMonth })}</p>
          </div>
          <Button title={t("supplements.orderNow")} fullWidth={false} onClick={() => navigate("/order-review")} />
        </div>
      </Card>

      <div style={styles.cardList}>
        {displayRecommendations.map((recommendation, index) => {
          const supplementDetails = getSupplementDetails(recommendation.supplementId);
          const content = translatedContent[recommendation.supplementId];
          const description = content?.description ?? SUPPLEMENT_DESCRIPTIONS[recommendation.supplementId];
          const grams =
            scaledGrams.find((item) => item.id === recommendation.supplementId)?.grams ??
            recommendation.dosageGramsPerDay ??
            parseDosageGrams(recommendation.dosage);

          return (
            <Card key={index} style={styles.card}>
              <div style={styles.headerRow}>
                <SectionHeader title={recommendation.supplementName} subtitle="" />
                <Badge label={getPriorityLabel(recommendation.priority)} tone={getPriorityBadgeTone(recommendation.priority)} />
              </div>

              <div style={styles.section}>
                <span style={styles.label}>{t("supplements.why")}</span>
                <p style={styles.body}>{recommendation.reason}</p>
              </div>

              {grams ? (
                <div style={styles.section}>
                  <span style={styles.label}>{t("supplements.servingGrams")}</span>
                  <p style={styles.body}>{t("supplements.perServing", { grams })}</p>
                </div>
              ) : null}

              {supplementDetails ? (
                <>
                  <div style={styles.section}>
                    <span style={styles.label}>{t("supplements.keyBenefits")}</span>
                    <ul style={styles.benefitsList}>
                      {(content?.benefits ?? supplementDetails.benefits).map((benefit, benefitIndex) => (
                        <li key={benefitIndex} style={styles.benefitItem}>{benefit}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={styles.section}>
                    <span style={styles.label}>{t("supplements.keyNutrients")}</span>
                    <div style={styles.nutrientTags}>
                      {(content?.keyNutrients ?? supplementDetails.keyNutrients).map((nutrient, nutrientIndex) => (
                        <span key={nutrientIndex} style={styles.nutrientTag}>{nutrient}</span>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

              <div style={styles.learnMoreRow}>
                <button
                  type="button"
                  style={styles.learnMoreButton}
                  onClick={() => setActiveSupplementId(recommendation.supplementId)}
                >
                  {t("supplements.learnMore")}
                </button>
                {!description ? <span style={styles.learnMoreHint}>{t("supplements.detailsSoon")}</span> : null}
              </div>
            </Card>
          );
        })}
      </div>

      {activeSupplementId ? (
        <Dialog
          title={getSupplementDetails(activeSupplementId)?.name ?? t("supplements.nutritionDetails")}
          description={translatedContent[activeSupplementId]?.description ?? SUPPLEMENT_DESCRIPTIONS[activeSupplementId] ?? t("supplements.detailsSoon")}
          onClose={() => setActiveSupplementId(null)}
          cancelLabel={t("supplements.close")}
        />
      ) : null}
    </div>
  );
};

const createStyles = (theme: AppTheme) => ({
  page: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl
  },
  heading: {
    ...theme.typography.displayMd,
    margin: 0
  },
  subheading: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    margin: 0
  },
  emptyCard: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.lg,
    textAlign: "center" as const
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 700,
    margin: 0
  },
  emptyBody: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    margin: 0
  },
  summaryCard: {
    background: theme.colors.accentBlue,
    border: `1px solid ${theme.colors.info}`,
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.lg
  },
  summaryText: {
    fontSize: 15,
    color: theme.colors.text,
    margin: 0,
    lineHeight: "22px"
  },
  pricingRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: theme.spacing.md,
    borderTop: `1px solid ${theme.colors.divider}`
  },
  priceLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    margin: 0,
    marginBottom: 4
  },
  priceAmount: {
    fontSize: 24,
    fontWeight: 700,
    color: theme.colors.primary,
    margin: 0
  },
  priceSub: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    margin: 0,
    marginTop: 4
  },
  blendMeta: {
    display: "grid",
    gap: theme.spacing.xs,
    fontSize: 13,
    color: theme.colors.textSecondary
  },
  cardList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.lg
  },
  card: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.lg
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: theme.spacing.md
  },
  section: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.xs
  },
  label: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    color: theme.colors.textSecondary
  },
  body: {
    fontSize: 15,
    color: theme.colors.text,
    margin: 0,
    lineHeight: "22px"
  },
  benefitsList: {
    margin: 0,
    paddingLeft: theme.spacing.lg,
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.xs
  },
  benefitItem: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: "20px"
  },
  nutrientTags: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: theme.spacing.xs
  },
  nutrientTag: {
    background: theme.colors.accentMint,
    color: theme.colors.success,
    fontSize: 12,
    fontWeight: 600,
    padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
    borderRadius: theme.radii.md
  },
  learnMoreRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  learnMoreButton: {
    border: `1px solid ${theme.colors.primary}`,
    background: theme.colors.primary,
    color: theme.colors.background,
    fontSize: 13,
    fontWeight: 700,
    padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
    borderRadius: theme.radii.lg,
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(212, 140, 68, 0.16)"
  },
  learnMoreHint: {
    fontSize: 12,
    color: theme.colors.textSecondary
  },
  notice: {
    border: `1px solid ${theme.colors.divider}`
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
    marginBottom: theme.spacing.xs
  },
  noticeBody: {
    fontSize: 14,
    color: theme.colors.warning,
    margin: 0
  }
});

export default SupplementsScreen;
