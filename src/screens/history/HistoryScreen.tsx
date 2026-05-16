import React, { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card";
import SectionHeader from "../../components/SectionHeader";
import { useI18n } from "../../i18n";
import { translateBloodworkAnalysis, type BloodworkAnalysis } from "../../services/openai";
import { AppTheme, useTheme } from "../../theme";
import { persistentStorage } from "../../services/persistentStorage";
import { useAuth } from "../../services/auth";
import { BloodworkRecord, fetchBloodworkHistory, replaceBloodworkHistory } from "../../services/bloodworkApi";

type HistoryRecommendation = {
  supplementName?: string;
  reason?: string;
  dosage?: string;
};

type HistoryInsight = {
  category?: string;
  findings?: string;
  impact?: string;
};

type HistoryEntry = {
  id: string;
  uploadedAt?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  summary?: string;
  concerns?: string[];
  strengths?: string[];
  recommendations?: HistoryRecommendation[];
  detailedInsights?: HistoryInsight[];
};

const HistoryScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { language, t } = useI18n();
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [displayHistory, setDisplayHistory] = useState<HistoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const scopedKey = (baseKey: string) => (user?.id ? `${baseKey}:${user.id}` : baseKey);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      const storedHistory = persistentStorage.getItem(scopedKey("bloodworkHistory"));
      let localHistory: HistoryEntry[] = [];
      if (storedHistory) {
        try {
          const parsed = JSON.parse(storedHistory);
          localHistory = Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          console.error("Failed to parse history:", error);
        }
      }

      try {
        const remoteRecords = await fetchBloodworkHistory();
        if (cancelled) return;

        if (remoteRecords.length > 0) {
          const remoteHistory = remoteRecords.map((record) => ({
            id: record.id,
            uploadedAt: record.uploadedAt,
            fileName: record.meta?.fileName,
            fileType: record.meta?.fileType,
            fileSize: record.meta?.fileSize,
            summary: record.analysis.summary,
            concerns: record.analysis.concerns || [],
            strengths: record.analysis.strengths || [],
            recommendations: record.analysis.recommendations || [],
            detailedInsights: record.analysis.detailedInsights || []
          }));
          setHistory(remoteHistory);
          persistentStorage.setItem(scopedKey("bloodworkHistory"), JSON.stringify(remoteHistory));
        } else {
          setHistory(localHistory);
          if (localHistory.length > 0) {
            const migratedHistory: BloodworkRecord[] = localHistory.map((entry) => ({
              id: entry.id,
              uploadedAt: entry.uploadedAt || new Date().toISOString(),
              analysis: {
                summary: entry.summary || "",
                concerns: entry.concerns || [],
                strengths: entry.strengths || [],
                recommendations: (entry.recommendations || []) as BloodworkAnalysis["recommendations"],
                detailedInsights: (entry.detailedInsights || []) as BloodworkAnalysis["detailedInsights"],
                parsedRows: [],
                translatedLanguage: "en" as const
              } as BloodworkAnalysis,
              meta: {
                uploadedAt: entry.uploadedAt,
                fileName: entry.fileName,
                fileType: entry.fileType,
                fileSize: entry.fileSize
              }
            }));
            void replaceBloodworkHistory(migratedHistory).catch((error) => {
              console.error("Failed to migrate local bloodwork history:", error);
            });
          }
        }
      } catch (error) {
        console.error("Failed to load remote history:", error);
        if (!cancelled) {
          setHistory(localHistory);
        }
      }
    };

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (language === "en") {
        setDisplayHistory(history);
        return;
      }

      const translated = await Promise.all(
        history.map(async (entry) => {
          const translatedAnalysis = await translateBloodworkAnalysis({
            summary: entry.summary || "",
            concerns: entry.concerns || [],
            strengths: entry.strengths || [],
            recommendations: (entry.recommendations || []).map((item) => ({
              supplementId: item.supplementName || "",
              supplementName: item.supplementName || "",
              reason: item.reason || "",
              dosage: item.dosage || "",
              priority: "medium"
            })),
            detailedInsights: (entry.detailedInsights || []).map((item) => ({
              category: item.category || "",
              findings: item.findings || "",
              impact: item.impact || ""
            }))
          } as BloodworkAnalysis, language);

          return {
            ...entry,
            summary: translatedAnalysis.summary,
            concerns: translatedAnalysis.concerns,
            strengths: translatedAnalysis.strengths,
            recommendations: translatedAnalysis.recommendations.map((item) => ({
              supplementName: item.supplementName,
              reason: item.reason,
              dosage: item.dosage
            })),
            detailedInsights: translatedAnalysis.detailedInsights
          } satisfies HistoryEntry;
        })
      );

      if (!cancelled) {
        setDisplayHistory(translated);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [history, language]);

  const selectedEntry = useMemo(
    () => displayHistory.find((entry) => entry.id === selectedId) || null,
    [displayHistory, selectedId]
  );

  const formatDate = (iso?: string) => {
    if (!iso) return t("history.unknownDate");
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return t("history.unknownDate");
    const locale = language === "zh" ? "zh-CN" : language === "bm" ? "ms-MY" : undefined;
    return date.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const formatFileMeta = (entry: HistoryEntry) => {
    const parts = [];
    if (entry.fileName) parts.push(entry.fileName);
    if (entry.fileSize) parts.push(`${Math.round(entry.fileSize / 1024)} KB`);
    if (entry.fileType) parts.push(entry.fileType);
    return parts.join(" | ");
  };

  const metricCards = (concernCount: number, strengthCount: number, recommendationCount: number) => [
    { key: "concerns", label: t("history.concerns"), value: concernCount },
    { key: "strengths", label: t("history.strengths"), value: strengthCount },
    { key: "recommendations", label: t("history.recommendations"), value: recommendationCount }
  ];

  if (selectedEntry) {
    const concernCount = selectedEntry.concerns?.length ?? 0;
    const strengthCount = selectedEntry.strengths?.length ?? 0;
    const recommendationCount = selectedEntry.recommendations?.length ?? 0;

    return (
      <div style={styles.page}>
        <button type="button" style={styles.backButton} onClick={() => setSelectedId(null)}>
          <span style={styles.backArrow}>{"<-"}</span>
          <span>{t("history.back")}</span>
        </button>

        <h1 style={styles.heading}>{t("history.detailTitle")}</h1>
        <p style={styles.subheading}>{t("history.detailSubtitle", { date: formatDate(selectedEntry.uploadedAt) })}</p>

        <Card style={styles.card}>
          <SectionHeader
            title={formatDate(selectedEntry.uploadedAt)}
            rightSlot={<span style={styles.badge}>{concernCount > 0 ? t("history.needsReview") : t("history.inRange")}</span>}
          />
          <p style={styles.cardSubtitle}>{formatFileMeta(selectedEntry)}</p>
          {selectedEntry.summary ? <p style={styles.summary}>{selectedEntry.summary}</p> : null}

          <div style={styles.statsGrid}>
            {metricCards(concernCount, strengthCount, recommendationCount).map((metric) => (
              <div key={metric.key} style={styles.statCard}>
                <span style={styles.statLabel}>{metric.label}</span>
                <p style={styles.statValue}>{metric.value}</p>
              </div>
            ))}
          </div>

          {selectedEntry.concerns && selectedEntry.concerns.length > 0 ? (
            <div style={styles.listBlock}>
              <span style={styles.listLabel}>{t("history.topConcerns")}</span>
              <ul style={styles.list}>
                {selectedEntry.concerns.map((item, index) => (
                  <li key={`${selectedEntry.id}-concern-${index}`} style={styles.listItem}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {selectedEntry.strengths && selectedEntry.strengths.length > 0 ? (
            <div style={styles.listBlock}>
              <span style={styles.listLabel}>{t("history.positiveFindings")}</span>
              <ul style={styles.list}>
                {selectedEntry.strengths.map((item, index) => (
                  <li key={`${selectedEntry.id}-strength-${index}`} style={styles.listItem}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {selectedEntry.recommendations && selectedEntry.recommendations.length > 0 ? (
            <div style={styles.listBlock}>
              <span style={styles.listLabel}>{t("history.recommendedNutrition")}</span>
              <div style={styles.insightList}>
                {selectedEntry.recommendations.map((item, index) => (
                  <div key={`${selectedEntry.id}-recommendation-${index}`} style={styles.insightItem}>
                    <span style={styles.insightLabel}>{item.supplementName || t("history.nutritionProduct")}</span>
                    {item.reason ? <p style={styles.insightText}>{item.reason}</p> : null}
                    {item.dosage ? <p style={styles.insightTextMuted}>{item.dosage}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {selectedEntry.detailedInsights && selectedEntry.detailedInsights.length > 0 ? (
            <div style={styles.listBlock}>
              <span style={styles.listLabel}>{t("history.keyInsights")}</span>
              <div style={styles.insightList}>
                {selectedEntry.detailedInsights.map((insight, index) => (
                  <div key={`${selectedEntry.id}-insight-${index}`} style={styles.insightItem}>
                    <span style={styles.insightLabel}>{insight.category}</span>
                    <p style={styles.insightText}>{insight.findings}</p>
                    <p style={styles.insightTextMuted}>{insight.impact}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>{t("history.title")}</h1>
      <p style={styles.subheading}>{t("history.subheading")}</p>

      <div style={styles.cardList}>
        {history.length > 0 ? (
          displayHistory.map((entry) => {
            const concernCount = entry.concerns?.length ?? 0;
            const strengthCount = entry.strengths?.length ?? 0;
            const recommendationCount = entry.recommendations?.length ?? 0;
            const topInsights = (entry.detailedInsights || []).slice(0, 2);

            return (
              <Card key={entry.id} style={styles.card}>
                <button
                  type="button"
                  style={styles.cardButton}
                  onClick={() => setSelectedId(entry.id)}
                >
                  <SectionHeader
                    title={formatDate(entry.uploadedAt)}
                    rightSlot={<span style={styles.badge}>{concernCount > 0 ? t("history.needsReview") : t("history.inRange")}</span>}
                  />
                  <p style={styles.cardSubtitle}>{formatFileMeta(entry)}</p>
                  {entry.summary ? <p style={styles.summary}>{entry.summary}</p> : null}

                  <div style={styles.statsGrid}>
                    {metricCards(concernCount, strengthCount, recommendationCount).map((metric) => (
                      <div key={`${entry.id}-${metric.key}`} style={styles.statCard}>
                        <span style={styles.statLabel}>{metric.label}</span>
                        <p style={styles.statValue}>{metric.value}</p>
                      </div>
                    ))}
                  </div>

                  {entry.concerns && entry.concerns.length > 0 ? (
                    <div style={styles.listBlock}>
                      <span style={styles.listLabel}>{t("history.topConcerns")}</span>
                      <ul style={styles.list}>
                        {entry.concerns.slice(0, 2).map((item, index) => (
                          <li key={`${entry.id}-top-concern-${index}`} style={styles.listItem}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {entry.strengths && entry.strengths.length > 0 ? (
                    <div style={styles.listBlock}>
                      <span style={styles.listLabel}>{t("history.positiveFindings")}</span>
                      <ul style={styles.list}>
                        {entry.strengths.slice(0, 2).map((item, index) => (
                          <li key={`${entry.id}-top-strength-${index}`} style={styles.listItem}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {topInsights.length > 0 ? (
                    <div style={styles.listBlock}>
                      <span style={styles.listLabel}>{t("history.keyInsights")}</span>
                      <div style={styles.insightList}>
                        {topInsights.map((insight, index) => (
                          <div key={`${entry.id}-top-insight-${index}`} style={styles.insightItem}>
                            <span style={styles.insightLabel}>{insight.category}</span>
                            <p style={styles.insightText}>{insight.findings}</p>
                            <p style={styles.insightTextMuted}>{insight.impact}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div style={styles.detailCtaRow}>
                    <span style={styles.detailCta}>{t("history.viewFullDetail")}</span>
                  </div>
                </button>
              </Card>
            );
          })
        ) : (
          <Card style={styles.emptyCard} shadow={false}>
            <h3 style={styles.emptyTitle}>{t("history.emptyTitle")}</h3>
            <p style={styles.emptyCopy}>{t("history.emptyBody")}</p>
          </Card>
        )}
      </div>

      {history.length > 0 ? (
        <Card style={styles.emptyCard} shadow={false}>
          <h3 style={styles.emptyTitle}>{t("history.moreDataTitle")}</h3>
          <p style={styles.emptyCopy}>{t("history.moreDataBody")}</p>
        </Card>
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
  backButton: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.sm,
    width: "fit-content",
    background: "transparent",
    border: "none",
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
    fontFamily: "inherit"
  },
  backArrow: {
    fontSize: 20,
    lineHeight: 1
  },
  cardList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.lg
  },
  card: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.md
  },
  cardButton: {
    width: "100%",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontFamily: "inherit",
    padding: 0,
    textAlign: "left" as const
  },
  badge: {
    background: theme.colors.accentBlue,
    color: theme.colors.info,
    fontWeight: 700,
    padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
    borderRadius: theme.radii.pill,
    fontSize: 12
  },
  cardSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    margin: 0,
    lineHeight: "18px",
    overflowWrap: "anywhere" as const,
    wordBreak: "break-word" as const
  },
  summary: {
    fontSize: 14,
    color: theme.colors.text,
    margin: 0,
    lineHeight: "20px"
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm}px 0`
  },
  statCard: {
    borderRadius: theme.radii.md,
    background: theme.colors.background,
    border: `1px solid ${theme.colors.divider}`,
    padding: `${theme.spacing.sm}px ${theme.spacing.sm}px ${theme.spacing.xs}px`,
    minWidth: 0
  },
  statLabel: {
    fontSize: 11,
    textTransform: "uppercase" as const,
    color: theme.colors.textSecondary,
    letterSpacing: 1,
    display: "block",
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  statValue: {
    fontSize: 18,
    fontWeight: 700,
    margin: `${theme.spacing.xs}px 0 0`
  },
  listBlock: {
    borderTop: `1px solid ${theme.colors.divider}`,
    paddingTop: theme.spacing.md
  },
  listLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: theme.colors.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 1
  },
  list: {
    margin: `${theme.spacing.xs}px 0 0`,
    paddingInlineStart: theme.spacing.lg,
    display: "grid",
    gap: theme.spacing.xs
  },
  listItem: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: "20px"
  },
  insightList: {
    marginTop: theme.spacing.sm,
    display: "grid",
    gap: theme.spacing.sm
  },
  insightItem: {
    borderRadius: theme.radii.lg,
    border: `1px solid ${theme.colors.divider}`,
    background: theme.colors.surface,
    padding: theme.spacing.md,
    display: "grid",
    gap: theme.spacing.xs
  },
  insightLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: theme.colors.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 1
  },
  insightText: {
    fontSize: 13,
    color: theme.colors.text,
    margin: 0
  },
  insightTextMuted: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    margin: 0
  },
  detailCtaRow: {
    borderTop: `1px solid ${theme.colors.divider}`,
    paddingTop: theme.spacing.md
  },
  detailCta: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: 700
  },
  emptyCard: {
    border: `1px solid ${theme.colors.divider}`
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
    marginBottom: theme.spacing.xs
  },
  emptyCopy: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    margin: 0
  }
});

export default HistoryScreen;
