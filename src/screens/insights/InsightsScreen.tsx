import React, { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Badge from "../../components/Badge";
import Card from "../../components/Card";
import SectionHeader from "../../components/SectionHeader";
import Button from "../../components/Button";
import { AppTheme, useTheme } from "../../theme";
import { BloodworkAnalysis, translateBloodworkAnalysis } from "../../services/openai";
import { persistentStorage } from "../../services/persistentStorage";
import { useI18n } from "../../i18n";

const domainScores = [
  { id: "energy", label: "Energy", score: 62, status: "On watch", description: "Ferritin and B12 suggest an opportunity to optimise energy production." },
  { id: "metabolic", label: "Metabolic", score: 78, status: "Solid", description: "Glucose and HbA1c within target. Continue balanced meals." },
  { id: "inflammation", label: "Inflammation", score: 54, status: "Needs attention", description: "hs-CRP at 2.4 mg/L�consider anti-inflammatory diet and stress support." }
];

const primaryTakeaways = [
  {
    id: "takeaway-1",
    what: "Ferritin is below optimal range for females",
    why: "Low ferritin can drive fatigue, hair changes, and brain fog.",
    action: "Increase iron-rich foods twice daily and pair with vitamin C",
    sources: "WHO, 2023; British Society for Haematology"
  },
  {
    id: "takeaway-2",
    what: "Sleep duration averages 6.2 hours",
    why: "Sleep debt can suppress immune resilience and insulin sensitivity.",
    action: "Aim for 7.5 hours with a 30 min wind-down routine",
    sources: "CDC sleep guidelines"
  }
];

const InsightsScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { language, t } = useI18n();
  const isChinese = language === "zh";
  const isMalay = language === "bm";
  const [analysis, setAnalysis] = useState<BloodworkAnalysis | null>(null);
  const [displayAnalysis, setDisplayAnalysis] = useState<BloodworkAnalysis | null>(null);
  const [analysisMeta, setAnalysisMeta] = useState<{ fileType?: string; fileName?: string } | null>(null);
  const [hasHydratedAnalysis, setHasHydratedAnalysis] = useState(false);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(true);

  useEffect(() => {
    // Load analysis from localStorage
    const storedAnalysis = persistentStorage.getItem("bloodworkAnalysis");
    const storedMeta = persistentStorage.getItem("bloodworkAnalysisMeta");
    if (storedAnalysis) {
      try {
        setAnalysis(JSON.parse(storedAnalysis));
      } catch (error) {
        console.error("Failed to parse bloodwork analysis:", error);
      }
    }
    if (storedMeta) {
      try {
        setAnalysisMeta(JSON.parse(storedMeta));
      } catch (error) {
        console.error("Failed to parse bloodwork analysis metadata:", error);
      }
    }
    setHasHydratedAnalysis(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedAnalysis) return;
    let cancelled = false;

    if (!analysis) {
      setDisplayAnalysis(null);
      setIsAnalysisLoading(false);
      return;
    }

    setIsAnalysisLoading(true);

    translateBloodworkAnalysis(analysis, language)
      .then((translated) => {
        if (!cancelled) {
          setDisplayAnalysis(translated);
          setIsAnalysisLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDisplayAnalysis(analysis);
          setIsAnalysisLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [analysis, hasHydratedAnalysis, language]);

  if (!hasHydratedAnalysis || isAnalysisLoading) {
    return (
      <div style={styles.page}>
        <h1 style={styles.heading}>{t("insights.heading")}</h1>
        <p style={styles.subheading}>{t("insights.subheading")}</p>

        <Card style={styles.emptyCard}>
          <h3 style={styles.emptyTitle}>{isChinese ? "正在加载洞察..." : isMalay ? "Sedang memuatkan wawasan..." : "Loading insights..."}</h3>
          <p style={styles.emptyBody}>{isChinese ? "正在准备你的分析结果。" : isMalay ? "Sedang menyediakan keputusan analisis anda." : "Preparing your analysis results."}</p>
        </Card>
      </div>
    );
  }

  // If no analysis available, show default content
  if (!displayAnalysis) {
    return (
      <div style={styles.page}>
        <h1 style={styles.heading}>{t("insights.heading")}</h1>
        <p style={styles.subheading}>{t("insights.emptySubheading")}</p>

        <Card style={styles.emptyCard}>
          <h3 style={styles.emptyTitle}>{t("insights.emptyTitle")}</h3>
          <p style={styles.emptyBody}>{t("insights.emptyBody")}</p>
          <Link to="/upload">
            <Button title={t("insights.uploadBloodwork")} fullWidth />
          </Link>
        </Card>

      </div>
    );
  }

  const sourceLabel =
    analysisMeta?.fileType === "image-analysis"
      ? isChinese
        ? "来源：AI 聊天图片分析"
        : isMalay
        ? "Sumber: analisis imej sembang AI"
        : "Source: AI chat image analysis"
      : analysisMeta?.fileType === "images"
      ? isChinese
        ? "来源：上传图片分析"
        : isMalay
        ? "Sumber: analisis imej yang dimuat naik"
        : "Source: uploaded image analysis"
      : analysisMeta?.fileType === "application/pdf"
      ? isChinese
        ? "来源：上传的 PDF 血液报告"
        : isMalay
        ? "Sumber: laporan darah PDF yang dimuat naik"
        : "Source: uploaded PDF bloodwork"
      : analysisMeta?.fileName
      ? `${isChinese ? "来源" : isMalay ? "Sumber" : "Source"}: ${analysisMeta.fileName}`
      : null;

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>{t("insights.heading")}</h1>
      <p style={styles.subheading}>{t("insights.subheading")}</p>
      {sourceLabel ? <p style={styles.sourceLabel}>{sourceLabel}</p> : null}

      {/* Summary Card */}
      <Card style={styles.summaryCard}>
        <SectionHeader title={t("insights.summary")} />
        <p style={styles.summaryText}>{displayAnalysis.summary}</p>
      </Card>

      {/* Concerns */}
      {displayAnalysis.concerns && displayAnalysis.concerns.length > 0 && (
        <Card style={styles.concernsCard}>
          <SectionHeader title={t("insights.attention")} />
          <div style={styles.listContainer}>
            {displayAnalysis.concerns.map((concern, index) => (
              <div key={index} style={styles.listItem}>
                <span style={styles.bullet}>⚠️</span>
                <p style={styles.listText}>{concern}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Strengths */}
      {displayAnalysis.strengths && displayAnalysis.strengths.length > 0 && (
        <Card style={styles.strengthsCard}>
          <SectionHeader title={t("insights.positive")} />
          <div style={styles.listContainer}>
            {displayAnalysis.strengths.map((strength, index) => (
              <div key={index} style={styles.listItem}>
                <span style={styles.bullet}>✓</span>
                <p style={styles.listText}>{strength}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Detailed Insights */}
      {displayAnalysis.detailedInsights && displayAnalysis.detailedInsights.length > 0 && (
        <Card style={styles.takeawayCard}>
          <SectionHeader title={t("insights.detailed")} />
          <div style={styles.takeawayList}>
            {displayAnalysis.detailedInsights.map((insight, index) => (
              <div key={index} style={styles.takeaway}>
                <span style={styles.takeawayLabel}>{insight.category}</span>
                <p style={styles.takeawayText}><strong>{t("insights.findings")}</strong> {insight.findings}</p>
                <p style={styles.takeawayText}><strong>{t("insights.impact")}</strong> {insight.impact}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Nutrition Recommendations */}
      {displayAnalysis.recommendations && displayAnalysis.recommendations.length > 0 && (
        <Card style={styles.recommendationsCard}>
          <SectionHeader title={t("insights.recommended")} />
          <p style={styles.recommendationsSubtext}>{t("insights.recommendedSubtext")}</p>
          <Link to="/supplements">
            <Button title={t("insights.viewRecommendations")} fullWidth />
          </Link>
        </Card>
      )}

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
    fontSize: 16,
    color: theme.colors.textSecondary,
    margin: 0
  },
  sourceLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    margin: 0,
    fontWeight: 600
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
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.md
  },
  summaryText: {
    fontSize: 15,
    color: theme.colors.text,
    margin: 0,
    lineHeight: "24px"
  },
  concernsCard: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.md,
    background: theme.colors.accentPeach,
    border: `1px solid ${theme.colors.warning}`
  },
  strengthsCard: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.md,
    background: theme.colors.accentMint,
    border: `1px solid ${theme.colors.success}`
  },
  listContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.sm
  },
  listItem: {
    display: "flex",
    gap: theme.spacing.sm,
    alignItems: "flex-start"
  },
  bullet: {
    fontSize: 16,
    flexShrink: 0
  },
  listText: {
    fontSize: 14,
    color: theme.colors.text,
    margin: 0,
    lineHeight: "20px"
  },
  recommendationsCard: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.md
  },
  recommendationsSubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    margin: 0
  },
  takeawayCard: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.lg
  },
  takeawayList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.lg
  },
  takeaway: {
    borderTop: `1px solid ${theme.colors.divider}`,
    paddingTop: theme.spacing.lg,
    display: "grid",
    gap: theme.spacing.sm
  },
  takeawayLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: theme.colors.textSecondary,
    textTransform: "uppercase" as const
  },
  takeawayText: {
    fontSize: 15,
    color: theme.colors.text,
    margin: 0
  },
  takeawaySources: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    margin: 0
  },
  noticeCard: {
    border: `1px solid ${theme.colors.divider}`
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
    marginBottom: theme.spacing.xs
  },
  noticeBody: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    margin: 0
  }
});

export default InsightsScreen;
