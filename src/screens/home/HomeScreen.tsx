import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
import Card from "../../components/Card";
import SectionHeader from "../../components/SectionHeader";
import StickyFooter from "../../components/StickyFooter";
import { AppTheme, useTheme } from "../../theme";

const mockInsights = [
  {
    id: "insight-1",
    title: "Iron stores trending low",
    summary: "Ferritin at 22 ng/mL. Consider iron-rich foods and schedule a retest in 12 weeks.",
    domain: "Energy"
  },
  {
    id: "insight-2",
    title: "Sleep opportunity",
    summary: "Average duration 6.2 hrs. Aim for 7.5 hrs with wind-down routine.",
    domain: "Sleep"
  }
];

const HomeScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();
  const width = `min(440px, calc(100% - ${theme.spacing.xl * 2}px))`;

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroPill}>Last upload • Jul 12</div>
        <h1 style={styles.heroTitle}>Upload bloodwork or DNA</h1>
        <p style={styles.heroCopy}>
          Get personalised ranges, supplement suggestions, and lifestyle nudges based on your biomarkers.
        </p>
        <div style={styles.heroBadges}>
          <Badge label="Auto-parse labs" tone="info" />
          <Badge label="Versioned history" tone="success" />
        </div>
      </section>

      <SectionHeader
        title="Latest insights"
        rightSlot={<Link to="/insights" style={styles.link}>View all</Link>}
        style={styles.sectionHeader}
      />

      <div style={styles.insightList}>
        {mockInsights.map((insight) => (
          <Card key={insight.id} style={styles.insightCard}>
            <Badge label={insight.domain} tone="info" />
            <h3 style={styles.cardTitle}>{insight.title}</h3>
            <p style={styles.cardBody}>{insight.summary}</p>
            <Link to="/insights" style={styles.cardLink}>
              See details
            </Link>
          </Card>
        ))}
      </div>

      <Card style={styles.statusCard} shadow={false}>
        <div style={styles.statusHeader}>
          <div>
            <h3 style={styles.statusTitle}>Last analysis</h3>
            <p style={styles.statusSub}>Based on panels uploaded 12 Jul 2025</p>
          </div>
          <Badge label="Needs review" tone="warning" />
        </div>
        <div style={styles.statusGrid}>
          <div>
            <span style={styles.statusLabel}>Ferritin</span>
            <p style={styles.statusValue}>22 ng/mL</p>
          </div>
          <div>
            <span style={styles.statusLabel}>Trend</span>
            <p style={styles.statusValue}>-2.1 over 6 mo</p>
          </div>
        </div>
      </Card>

      <StickyFooter width={width}>
        <Button title="Upload labs" fullWidth onClick={() => navigate("/upload")} style={{ flex: 1 }} />
        <Button title="View history" variant="secondary" onClick={() => navigate("/history")} style={{ minWidth: 140 }} />
      </StickyFooter>
    </div>
  );
};

const createStyles = (theme: AppTheme) => ({
  page: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl
  },
  hero: {
    background: "linear-gradient(135deg, #FFF1F4 0%, #F4F7FF 100%)",
    borderRadius: theme.radii.xl,
    padding: `${theme.spacing.xxl}px ${theme.spacing.xl}px`,
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.lg
  },
  heroPill: {
    alignSelf: "flex-start" as const,
    borderRadius: theme.radii.pill,
    background: "rgba(255,56,92,0.15)",
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: 600,
    padding: `${theme.spacing.xs}px ${theme.spacing.md}px`
  },
  heroTitle: {
    ...theme.typography.headingLg,
    margin: 0,
    color: theme.colors.text
  },
  heroCopy: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    margin: 0,
    lineHeight: "24px"
  },
  heroBadges: {
    display: "flex",
    gap: theme.spacing.sm,
    flexWrap: "wrap" as const
  },
  sectionHeader: {
    marginTop: theme.spacing.sm
  },
  link: {
    color: theme.colors.primary,
    fontWeight: 600
  },
  insightList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.md
  },
  insightCard: {
    padding: `${theme.spacing.lg}px ${theme.spacing.lg}px ${theme.spacing.md}px`,
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.sm
  },
  cardTitle: {
    ...theme.typography.headingSm,
    margin: 0
  },
  cardBody: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    margin: 0
  },
  cardLink: {
    color: theme.colors.primary,
    fontWeight: 600,
    fontSize: 14
  },
  statusCard: {
    marginTop: theme.spacing.sm,
    border: `1px solid ${theme.colors.divider}`
  },
  statusHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: 700,
    margin: 0
  },
  statusSub: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    margin: `${theme.spacing.xs}px 0 0`
  },
  statusGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0,1fr))",
    gap: theme.spacing.md
  },
  statusLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: 1
  },
  statusValue: {
    fontSize: 16,
    fontWeight: 700,
    margin: `${theme.spacing.xs}px 0 0`
  }
});

export default HomeScreen;
