import React, { useEffect, useMemo, useState } from "react";
import Card from "../../components/Card";
import SectionHeader from "../../components/SectionHeader";
import { AppTheme, useTheme } from "../../theme";

type HistoryEntry = {
  id: string;
  uploadedAt?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  summary?: string;
  concerns?: string[];
  strengths?: string[];
  recommendations?: { supplementName?: string }[];
  detailedInsights?: { category?: string; findings?: string; impact?: string }[];
};

const HistoryScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

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
    return parts.join(" • ");
  };

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
            const insights = entry.detailedInsights || [];
            const topInsights = insights.slice(0, 2);

            return (
              <Card key={entry.id} style={styles.card}>
                <SectionHeader
                  title={formatDate(entry.uploadedAt)}
                  rightSlot={<span style={styles.badge}>{concernCount > 0 ? "Needs review" : "In range"}</span>}
                />
                <p style={styles.cardSubtitle}>{formatFileMeta(entry)}</p>
                {entry.summary && <p style={styles.summary}>{entry.summary}</p>}

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

                {entry.concerns && entry.concerns.length > 0 && (
                  <div style={styles.listBlock}>
                    <span style={styles.listLabel}>Top concerns</span>
                    <ul style={styles.list}>
                      {entry.concerns.slice(0, 2).map((item, index) => (
                        <li key={index} style={styles.listItem}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {entry.strengths && entry.strengths.length > 0 && (
                  <div style={styles.listBlock}>
                    <span style={styles.listLabel}>Positive findings</span>
                    <ul style={styles.list}>
                      {entry.strengths.slice(0, 2).map((item, index) => (
                        <li key={index} style={styles.listItem}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {topInsights.length > 0 && (
                  <div style={styles.listBlock}>
                    <span style={styles.listLabel}>Key insights</span>
                    <div style={styles.insightList}>
                      {topInsights.map((insight, index) => (
                        <div key={index} style={styles.insightItem}>
                          <span style={styles.insightLabel}>{insight.category}</span>
                          <p style={styles.insightText}>{insight.findings}</p>
                          <p style={styles.insightTextMuted}>{insight.impact}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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

      {history.length > 0 && (
        <Card style={styles.emptyCard} shadow={false}>
          <h3 style={styles.emptyTitle}>Need more data points?</h3>
          <p style={styles.emptyCopy}>Upload labs every 3-6 months to unlock full trend charts and exportable reports.</p>
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
    fontSize: 15,
    color: theme.colors.textSecondary,
    margin: 0
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
  footerRow: {
    borderTop: `1px solid ${theme.colors.divider}`,
    paddingTop: theme.spacing.md
  },
  footerLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: theme.colors.textSecondary,
    textTransform: "uppercase" as const
  },
  footerValue: {
    fontSize: 14,
    color: theme.colors.textSecondary
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
