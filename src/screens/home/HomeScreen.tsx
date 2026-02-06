import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
import Card from "../../components/Card";
import SectionHeader from "../../components/SectionHeader";
import StickyFooter from "../../components/StickyFooter";
import { AppTheme, useTheme } from "../../theme";
import { BloodworkAnalysis } from "../../services/openai";

type AnalysisMeta = {
  uploadedAt?: string;
  fileName?: string;
  fileType?: string;
};

const HomeScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();
  const width = `min(440px, calc(100% - ${theme.spacing.xl * 2}px))`;
  const [analysis, setAnalysis] = useState<BloodworkAnalysis | null>(null);
  const [meta, setMeta] = useState<AnalysisMeta | null>(null);

  useEffect(() => {
    const storedAnalysis = localStorage.getItem("bloodworkAnalysis");
    if (storedAnalysis) {
      try {
        setAnalysis(JSON.parse(storedAnalysis));
      } catch (error) {
        console.error("Failed to parse bloodwork analysis:", error);
      }
    }

    const storedMeta = localStorage.getItem("bloodworkAnalysisMeta");
    if (storedMeta) {
      try {
        setMeta(JSON.parse(storedMeta));
      } catch (error) {
        console.error("Failed to parse bloodwork metadata:", error);
      }
    }
  }, []);

  const formatDate = (iso?: string) => {
    if (!iso) return "No uploads yet";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "No uploads yet";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const latestInsights = (analysis?.detailedInsights || [])
    .slice(0, 2)
    .map((insight, index) => ({
      id: `insight-${index}`,
      title: insight.findings,
      summary: insight.impact,
      domain: insight.category
    }));

  const concernCount = analysis?.concerns?.length || 0;
  const recommendationCount = analysis?.recommendations?.length || 0;
  const statusTone = concernCount > 0 ? "warning" : "success";
  const statusLabel = concernCount > 0 ? "Needs review" : "In range";

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroPill}>Last upload - {formatDate(meta?.uploadedAt)}</div>
        <h1 style={styles.heroTitle}>Understand Your Body's Story</h1>
        <p style={styles.heroCopy}>
          Upload your bloodwork or DNA to get simple explanations, custom supplement plans, and lifestyle tips tailored to you.
        </p>
        <div style={styles.heroBadges}>
          <Badge label="Instant Lab Analysis" tone="info" />
          <Badge label="Health Progress" tone="success" />
        </div>
      </section>

      <SectionHeader
        title="Latest insights"
        rightSlot={<Link to="/insights" style={styles.link}>View all</Link>}
        style={styles.sectionHeader}
      />

      <div style={styles.insightList}>
        {latestInsights.length > 0 ? (
          latestInsights.map((insight) => (
            <Card key={insight.id} style={styles.insightCard}>
              <Badge label={insight.domain} tone="info" />
              <h3 style={styles.cardTitle}>{insight.title}</h3>
              <p style={styles.cardBody}>{insight.summary}</p>
              <Link to="/insights" style={styles.cardLink}>
                See details
              </Link>
            </Card>
          ))
        ) : (
          <Card style={styles.insightCard}>
            <h3 style={styles.cardTitle}>No insights yet</h3>
            <p style={styles.cardBody}>Ready to see what's happening inside? Upload your first report to unlock your health analysis.</p>
            <Link to="/upload" style={styles.cardLink}>
              Upload now
            </Link>
          </Card>
        )}
      </div>

      <Card style={styles.statusCard} shadow={false}>
        <div style={styles.statusHeader}>
          <div>
            <h3 style={styles.statusTitle}>Last analysis</h3>
            <p style={styles.statusSub}>
              {meta?.uploadedAt ? `Based on panels uploaded ${formatDate(meta.uploadedAt)}` : "No uploads yet"}
            </p>
          </div>
          <Badge label={statusLabel} tone={statusTone} />
        </div>
        <div style={styles.statusGrid}>
          <div>
            <span style={styles.statusLabel}>Concerns</span>
            <p style={styles.statusValue}>{concernCount}</p>
          </div>
          <div>
            <span style={styles.statusLabel}>Recommendations</span>
            <p style={styles.statusValue}>{recommendationCount}</p>
          </div>
        </div>
        {analysis?.summary && (
          <p style={styles.statusSummary}>{analysis.summary}</p>
        )}
      </Card>

      <StickyFooter width={width}>
        <Button title="Upload" fullWidth onClick={() => navigate("/upload")} style={{ flex: 1 }} />
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
    background: `linear-gradient(135deg, ${theme.colors.accentPeach} 0%, ${theme.colors.accentBlue} 100%)`,
    borderRadius: theme.radii.xl,
    padding: `${theme.spacing.xxl}px ${theme.spacing.xl}px`,
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.lg
  },
  heroPill: {
    alignSelf: "flex-start" as const,
    borderRadius: theme.radii.pill,
    background: `${theme.colors.primary}22`,
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
  },
  statusSummary: {
    marginTop: theme.spacing.md,
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: "20px"
  }
});

export default HomeScreen;
