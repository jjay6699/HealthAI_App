import React, { useMemo } from "react";
import Card from "../../components/Card";
import SectionHeader from "../../components/SectionHeader";
import { AppTheme, useTheme } from "../../theme";

const trends = [
  {
    id: "ferritin",
    name: "Ferritin",
    unit: "ng/mL",
    data: [
      { date: "2024-11-01", value: 28 },
      { date: "2025-02-01", value: 24 },
      { date: "2025-05-01", value: 22 }
    ],
    status: "Trending down"
  },
  {
    id: "a1c",
    name: "HbA1c",
    unit: "%",
    data: [
      { date: "2024-11-01", value: 5.3 },
      { date: "2025-05-01", value: 5.2 }
    ],
    status: "Stable"
  }
];

const HistoryScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>History</h1>
      <p style={styles.subheading}>Track biomarker trends and see how your recommendations evolved.</p>

      <div style={styles.cardList}>
        {trends.map((trend) => (
          <Card key={trend.id} style={styles.card}>
            <SectionHeader title={trend.name} rightSlot={<span style={styles.badge}>{trend.status}</span>} />
            <p style={styles.cardSubtitle}>Reference range available on upload summary.</p>
            <div style={styles.timeline}>
              {trend.data.map((point) => (
                <div key={point.date} style={styles.timelinePoint}>
                  <div style={styles.dot} />
                  <div>
                    <p style={styles.value}>
                      {point.value} {trend.unit}
                    </p>
                    <span style={styles.date}>{point.date}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={styles.footerRow}>
              <span style={styles.footerLabel}>Notes</span>
              <p style={styles.footerValue}>Add context from lifestyle changes or supplements.</p>
            </div>
          </Card>
        ))}
      </div>

      <Card style={styles.emptyCard} shadow={false}>
        <h3 style={styles.emptyTitle}>Need more data points?</h3>
        <p style={styles.emptyCopy}>Upload labs every 3-6 months to unlock full trend charts and exportable reports.</p>
      </Card>
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
    fontSize: 13,
    color: theme.colors.textSecondary,
    margin: 0
  },
  timeline: {
    borderLeft: `1px solid ${theme.colors.divider}`,
    paddingLeft: theme.spacing.lg,
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.lg
  },
  timelinePoint: {
    position: "relative" as const,
    paddingLeft: theme.spacing.md
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    background: theme.colors.primary,
    position: "absolute" as const,
    left: -theme.spacing.lg,
    top: 4
  },
  value: {
    fontSize: 15,
    fontWeight: 600,
    color: theme.colors.text,
    margin: 0
  },
  date: {
    fontSize: 12,
    color: theme.colors.textSecondary
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
