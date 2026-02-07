import React, { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card";
import SectionHeader from "../../components/SectionHeader";
import { AppTheme, useTheme } from "../../theme";

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
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const storedHistory = localStorage.getItem("bloodworkHistory");
    if (!storedHistory) return;
    try {
      const parsed = JSON.parse(storedHistory);
      if (Array.isArray(parsed)) {
        setHistory(parsed);
      }
    } catch (error) {
      console.error("Failed to parse history:", error);
    }
  }, []);

  const selectedEntry = useMemo(
    () => history.find((entry) => entry.id === selectedId) || null,
    [history, selectedId]
  );

  const formatDate = (iso?: string) => {
    if (!iso) return "Unknown date";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "Unknown date";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const formatFileMeta = (entry: HistoryEntry) => {
    const parts = [];
    if (entry.fileName) parts.push(entry.fileName);
    if (entry.fileSize) parts.push(`${Math.round(entry.fileSize / 1024)} KB`);
    if (entry.fileType) parts.push(entry.fileType);
    return parts.join(" | ");
  };

  if (selectedEntry) {
    const concernCount = selectedEntry.concerns?.length ?? 0;
    const strengthCount = selectedEntry.strengths?.length ?? 0;
    const recommendationCount = selectedEntry.recommendations?.length ?? 0;

    return (
      <div style={styles.page}>
        <button type="button" style={styles.backButton} onClick={() => setSelectedId(null)}>
          <span style={styles.backArrow}>{"<-"}</span>
          <span>Back to all history</span>
        </button>

        <h1 style={styles.heading}>History Detail</h1>
        <p style={styles.subheading}>Full review from {formatDate(selectedEntry.uploadedAt)}.</p>

        <Card style={styles.card}>
          <SectionHeader
            title={formatDate(selectedEntry.uploadedAt)}
            rightSlot={<span style={styles.badge}>{concernCount > 0 ? "Needs review" : "In range"}</span>}
          />
          <p style={styles.cardSubtitle}>{formatFileMeta(selectedEntry)}</p>
          {selectedEntry.summary ? <p style={styles.summary}>{selectedEntry.summary}</p> : null}

          <div style={styles.statsGrid}>
            <div>
              <span style={styles.statLabel}>Concerns</span>
              <p style={styles.statValue}>{concernCount}</p>
            </div>
            <div>
              <span style={styles.statLabel}>Strengths</span>
              <p style={styles.statValue}>{strengthCount}</p>
            </div>
            <div>
              <span style={styles.statLabel}>Recommendations</span>
              <p style={styles.statValue}>{recommendationCount}</p>
            </div>
          </div>

          {selectedEntry.concerns && selectedEntry.concerns.length > 0 ? (
            <div style={styles.listBlock}>
              <span style={styles.listLabel}>Top concerns</span>
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
              <span style={styles.listLabel}>Positive findings</span>
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
              <span style={styles.listLabel}>Recommended nutrition</span>
              <div style={styles.insightList}>
                {selectedEntry.recommendations.map((item, index) => (
                  <div key={`${selectedEntry.id}-recommendation-${index}`} style={styles.insightItem}>
                    <span style={styles.insightLabel}>{item.supplementName || "Nutrition product"}</span>
                    {item.reason ? <p style={styles.insightText}>{item.reason}</p> : null}
                    {item.dosage ? <p style={styles.insightTextMuted}>{item.dosage}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {selectedEntry.detailedInsights && selectedEntry.detailedInsights.length > 0 ? (
            <div style={styles.listBlock}>
              <span style={styles.listLabel}>Key insights</span>
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
      <h1 style={styles.heading}>History</h1>
      <p style={styles.subheading}>Track biomarker trends and see how your recommendations evolved.</p>

      <div style={styles.cardList}>
        {history.length > 0 ? (
          history.map((entry) => {
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
                    rightSlot={<span style={styles.badge}>{concernCount > 0 ? "Needs review" : "In range"}</span>}
                  />
                  <p style={styles.cardSubtitle}>{formatFileMeta(entry)}</p>
                  {entry.summary ? <p style={styles.summary}>{entry.summary}</p> : null}

                  <div style={styles.statsGrid}>
                    <div>
                      <span style={styles.statLabel}>Concerns</span>
                      <p style={styles.statValue}>{concernCount}</p>
                    </div>
                    <div>
                      <span style={styles.statLabel}>Strengths</span>
                      <p style={styles.statValue}>{strengthCount}</p>
                    </div>
                    <div>
                      <span style={styles.statLabel}>Recommendations</span>
                      <p style={styles.statValue}>{recommendationCount}</p>
                    </div>
                  </div>

                  {entry.concerns && entry.concerns.length > 0 ? (
                    <div style={styles.listBlock}>
                      <span style={styles.listLabel}>Top concerns</span>
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
                      <span style={styles.listLabel}>Positive findings</span>
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
                      <span style={styles.listLabel}>Key insights</span>
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
                    <span style={styles.detailCta}>View full detail</span>
                  </div>
                </button>
              </Card>
            );
          })
        ) : (
          <Card style={styles.emptyCard} shadow={false}>
            <h3 style={styles.emptyTitle}>No uploads yet</h3>
            <p style={styles.emptyCopy}>Upload labs to build your history and track changes over time.</p>
          </Card>
        )}
      </div>

      {history.length > 0 ? (
        <Card style={styles.emptyCard} shadow={false}>
          <h3 style={styles.emptyTitle}>Need more data points?</h3>
          <p style={styles.emptyCopy}>Upload labs every 3-6 months to unlock full trend charts and exportable reports.</p>
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
    margin: 0
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
    gap: theme.spacing.md,
    padding: `${theme.spacing.sm}px 0`
  },
  statLabel: {
    fontSize: 11,
    textTransform: "uppercase" as const,
    color: theme.colors.textSecondary,
    letterSpacing: 1
  },
  statValue: {
    fontSize: 16,
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
    color: theme.colors.textSecondary
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
