import React, { useMemo, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
import Card from "../../components/Card";
import SectionHeader from "../../components/SectionHeader";
import { AppTheme, useTheme } from "../../theme";
import { BloodworkAnalysis, SupplementRecommendation } from "../../services/openai";
import { AVAILABLE_SUPPLEMENTS, Supplement } from "../../data/supplements";

const SupplementsScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<SupplementRecommendation[]>([]);

  useEffect(() => {
    // Load recommendations from localStorage
    const storedAnalysis = localStorage.getItem("bloodworkAnalysis");
    if (storedAnalysis) {
      try {
        const analysis: BloodworkAnalysis = JSON.parse(storedAnalysis);
        setRecommendations(analysis.recommendations || []);
      } catch (error) {
        console.error("Failed to parse bloodwork analysis:", error);
      }
    }
  }, []);

  // Get full supplement details for each recommendation
  const getSupplementDetails = (supplementId: string): Supplement | undefined => {
    return AVAILABLE_SUPPLEMENTS.find(s => s.id === supplementId);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return theme.colors.error;
      case "medium":
        return theme.colors.warning;
      case "low":
        return theme.colors.info;
      default:
        return theme.colors.textSecondary;
    }
  };

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

  // If no recommendations, show empty state
  if (recommendations.length === 0) {
    return (
      <div style={styles.page}>
        <h1 style={styles.heading}>Supplement recommendations</h1>
        <p style={styles.subheading}>Get personalized supplement recommendations based on your bloodwork.</p>

        <Card style={styles.emptyCard}>
          <h3 style={styles.emptyTitle}>No recommendations yet</h3>
          <p style={styles.emptyBody}>
            Upload your bloodwork to receive AI-powered supplement recommendations tailored to your health needs.
          </p>
          <Link to="/upload">
            <Button title="Upload Bloodwork" fullWidth />
          </Link>
        </Card>

        <Card style={styles.notice} shadow={false}>
          <h3 style={styles.noticeTitle}>Our Supplement Collection</h3>
          <p style={styles.noticeBody}>
            We offer {AVAILABLE_SUPPLEMENTS.length} premium superfood supplements including wheatgrass, spirulina, turmeric, and more.
          </p>
        </Card>
      </div>
    );
  }

  const parseDosageGrams = (dosage?: string) => {
    if (!dosage) return undefined;
    const matches = [...dosage.matchAll(/(\d+(\.\d+)?)\s*g/gi)].map((m) => Number(m[1]));
    if (matches.length === 0) return undefined;
    if (matches.length === 1) return matches[0];
    const sum = matches.reduce((acc, val) => acc + val, 0);
    return sum / matches.length;
  };

  const totalGrams = recommendations.reduce((sum, rec) => {
    const grams = rec.dosageGramsPerDay ?? parseDosageGrams(rec.dosage);
    return grams ? sum + grams : sum;
  }, 0);

  const totalPills = recommendations.reduce((sum, rec) => {
    return rec.pillsPerDay ? sum + rec.pillsPerDay : sum;
  }, 0);

  const pillSizeMg = recommendations.find((rec) => rec.pillSizeMg)?.pillSizeMg;

  // Generate combined summary
  const generateSummary = () => {
    const supplementNames = recommendations.map(rec => rec.supplementName).join(", ");
    const gramsText = totalGrams > 0 ? `Total daily blend: ${totalGrams.toFixed(1)} g` : "";
    const pillsText = totalPills > 0 ? `Pills per day: ${totalPills}` : "";
    const pillSizeText = pillSizeMg ? `Pill size: ${pillSizeMg} mg` : "";
    const summaryParts = [gramsText, pillsText, pillSizeText].filter(Boolean).join(" • ");
    const summaryTail = summaryParts ? ` ${summaryParts}.` : "";
    return `Your personalized blend includes ${supplementNames}. This combination is specifically formulated based on your bloodwork analysis to address your unique nutritional needs.${summaryTail}`;
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Your personalized supplements</h1>
      <p style={styles.subheading}>
        Based on your bloodwork analysis, we recommend the following supplements from our collection.
      </p>

      {/* Combined Summary Card */}
      <Card style={styles.summaryCard}>
        <SectionHeader title="Your Custom Blend" />
        <p style={styles.summaryText}>{generateSummary()}</p>
        <div style={styles.pricingRow}>
          <div>
            <p style={styles.priceLabel}>Monthly Supply</p>
            <p style={styles.priceAmount}>RM49</p>
          </div>
          <Button
            title="Order Now"
            fullWidth={false}
            onClick={() => navigate("/order-review")}
          />
        </div>
      </Card>

      <div style={styles.cardList}>
        {recommendations.map((rec, index) => {
          const supplementDetails = getSupplementDetails(rec.supplementId);

          return (
            <Card key={index} style={styles.card}>
              <div style={styles.headerRow}>
                <div>
                  <SectionHeader
                    title={rec.supplementName}
                    subtitle=""
                  />
                </div>
                <Badge
                  label={`${rec.priority} priority`}
                  tone={getPriorityBadgeTone(rec.priority)}
                />
              </div>

              <div style={styles.section}>
                <span style={styles.label}>Why we recommend this</span>
                <p style={styles.body}>{rec.reason}</p>
              </div>

              {rec.dosage && (
                <div style={styles.section}>
                  <span style={styles.label}>Daily dosage</span>
                  <p style={styles.body}>{rec.dosage}</p>
                </div>
              )}
              {(rec.dosageGramsPerDay || rec.pillsPerDay) && (
                <div style={styles.section}>
                  <span style={styles.label}>Pill plan</span>
                  <p style={styles.body}>
                    {rec.dosageGramsPerDay ? `${rec.dosageGramsPerDay} g/day` : "Grams per day: N/A"}
                    {rec.pillsPerDay ? ` • ${rec.pillsPerDay} pills/day` : ""}
                    {rec.pillSizeMg ? ` • ${rec.pillSizeMg} mg per pill` : ""}
                  </p>
                </div>
              )}

              {supplementDetails && (
                <>
                  <div style={styles.section}>
                    <span style={styles.label}>Key benefits</span>
                    <ul style={styles.benefitsList}>
                      {supplementDetails.benefits.map((benefit, i) => (
                        <li key={i} style={styles.benefitItem}>{benefit}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={styles.section}>
                    <span style={styles.label}>Key nutrients</span>
                    <div style={styles.nutrientTags}>
                      {supplementDetails.keyNutrients.map((nutrient, i) => (
                        <span key={i} style={styles.nutrientTag}>{nutrient}</span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </Card>
          );
        })}
      </div>
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
