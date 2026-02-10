import React, { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Badge from "../../components/Badge";
import Card from "../../components/Card";
import SectionHeader from "../../components/SectionHeader";
import Button from "../../components/Button";
import { AppTheme, useTheme } from "../../theme";
import { BloodworkAnalysis } from "../../services/openai";
import { persistentStorage } from "../../services/persistentStorage";

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
  const [analysis, setAnalysis] = useState<BloodworkAnalysis | null>(null);

  useEffect(() => {
    // Load analysis from localStorage
    const storedAnalysis = persistentStorage.getItem("bloodworkAnalysis");
    if (storedAnalysis) {
      try {
        setAnalysis(JSON.parse(storedAnalysis));
      } catch (error) {
        console.error("Failed to parse bloodwork analysis:", error);
      }
    }
  }, []);

  // If no analysis available, show default content
  if (!analysis) {
    return (
      <div style={styles.page}>
        <h1 style={styles.heading}>Your insights</h1>
        <p style={styles.subheading}>Upload your bloodwork to get personalized AI-powered insights.</p>

        <Card style={styles.emptyCard}>
          <h3 style={styles.emptyTitle}>No analysis yet</h3>
          <p style={styles.emptyBody}>
            Upload your lab results to receive personalized health insights and nutrition recommendations powered by AI.
          </p>
          <Link to="/upload">
            <Button title="Upload Bloodwork" fullWidth />
          </Link>
        </Card>

      </div>
    );
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Your insights</h1>
      <p style={styles.subheading}>AI-powered analysis of your bloodwork results.</p>

      {/* Summary Card */}
      <Card style={styles.summaryCard}>
        <SectionHeader title="Overall Summary" />
        <p style={styles.summaryText}>{analysis.summary}</p>
      </Card>

      {/* Concerns */}
      {analysis.concerns && analysis.concerns.length > 0 && (
        <Card style={styles.concernsCard}>
          <SectionHeader title="Areas of Attention" />
          <div style={styles.listContainer}>
            {analysis.concerns.map((concern, index) => (
              <div key={index} style={styles.listItem}>
                <span style={styles.bullet}>⚠️</span>
                <p style={styles.listText}>{concern}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Strengths */}
      {analysis.strengths && analysis.strengths.length > 0 && (
        <Card style={styles.strengthsCard}>
          <SectionHeader title="Positive Findings" />
          <div style={styles.listContainer}>
            {analysis.strengths.map((strength, index) => (
              <div key={index} style={styles.listItem}>
                <span style={styles.bullet}>✓</span>
                <p style={styles.listText}>{strength}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Detailed Insights */}
      {analysis.detailedInsights && analysis.detailedInsights.length > 0 && (
        <Card style={styles.takeawayCard}>
          <SectionHeader title="Detailed Insights" />
          <div style={styles.takeawayList}>
            {analysis.detailedInsights.map((insight, index) => (
              <div key={index} style={styles.takeaway}>
                <span style={styles.takeawayLabel}>{insight.category}</span>
                <p style={styles.takeawayText}><strong>Findings:</strong> {insight.findings}</p>
                <p style={styles.takeawayText}><strong>Impact:</strong> {insight.impact}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Nutrition Recommendations */}
      {analysis.recommendations && analysis.recommendations.length > 0 && (
        <Card style={styles.recommendationsCard}>
          <SectionHeader title="Recommended Nutrition" />
          <p style={styles.recommendationsSubtext}>
            Based on your bloodwork, we recommend the following nutrition products from our collection:
          </p>
          <Link to="/supplements">
            <Button title="View All Recommendations" fullWidth />
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

