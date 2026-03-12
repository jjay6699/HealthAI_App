import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/Card";
import Button from "../../components/Button";
import SectionHeader from "../../components/SectionHeader";
import { useI18n } from "../../i18n";
import { AppTheme, useTheme } from "../../theme";
import { BloodworkAnalysis } from "../../services/openai";
import { persistentStorage } from "../../services/persistentStorage";

const OrderReviewScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<"one-bottle" | "one-month" | "three-months">("one-month");
  const [analysis, setAnalysis] = useState<BloodworkAnalysis | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<string | null>(null);

  useEffect(() => {
    const storedAnalysis = persistentStorage.getItem("bloodworkAnalysis");
    if (!storedAnalysis) return;

    try {
      setAnalysis(JSON.parse(storedAnalysis));
    } catch (error) {
      console.error("Failed to parse analysis:", error);
    }
  }, []);

  const plans = [
    { id: "one-bottle", label: t("order.review.oneBottle"), price: 45, description: t("order.review.oneBottleDesc") },
    { id: "one-month", label: t("order.review.oneMonth"), price: 85, description: t("order.review.oneMonthDesc") },
    { id: "three-months", label: t("order.review.threeMonths"), price: 240, description: t("order.review.threeMonthsDesc") }
  ];

  const selectedPlanDetails = plans.find((plan) => plan.id === selectedPlan);

  const handleContinue = () => {
    persistentStorage.setItem("orderDetails", JSON.stringify({
      plan: selectedPlan,
      planLabel: selectedPlanDetails?.label,
      price: selectedPlanDetails?.price,
      recommendations: analysis?.recommendations,
      couponCode: couponApplied
    }));
    navigate("/checkout");
  };

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) {
      setCouponApplied(null);
      return;
    }
    setCouponApplied(couponCode.trim().toUpperCase());
  };

  if (!analysis) {
    return (
      <div style={styles.page}>
        <h1 style={styles.heading}>{t("order.review.noOrder")}</h1>
        <p style={styles.subheading}>{t("order.review.noOrderBody")}</p>
        <Button title={t("insights.uploadBloodwork")} onClick={() => navigate("/upload")} />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <button onClick={() => navigate("/supplements")} style={styles.backButton}>
        <span style={styles.backArrow}>←</span>
        <span>{t("order.review.back")}</span>
      </button>

      <h1 style={styles.heading}>{t("order.review.heading")}</h1>
      <p style={styles.subheading}>{t("order.review.subheading")}</p>

      <Card style={styles.card}>
        <SectionHeader title={t("order.review.customBlend")} />
        <div style={styles.supplementList}>
          {analysis.recommendations.map((recommendation, index) => (
            <div key={index} style={styles.supplementItem}>
              <div style={styles.supplementIcon}>💊</div>
              <div style={styles.supplementInfo}>
                <span style={styles.supplementName}>{recommendation.supplementName}</span>
                <span style={styles.supplementDosage}>
                  {(recommendation.dosage || "")
                    .replace(/per day/gi, "per serving size")
                    .replace(/g\/day/gi, "g per serving size")}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={styles.card}>
        <SectionHeader title={t("order.review.choosePlan")} />
        <div style={styles.planList}>
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <button
                key={plan.id}
                style={{
                  ...styles.planOption,
                  borderColor: isSelected ? theme.colors.primary : theme.colors.divider,
                  boxShadow: isSelected ? "0 2px 8px rgba(239, 68, 68, 0.1)" : "none"
                }}
                onClick={() => setSelectedPlan(plan.id as typeof selectedPlan)}
              >
                <div style={styles.radioContainer}>
                  <div style={{ ...styles.radio, ...(isSelected ? styles.radioSelected : {}) }}>
                    {isSelected ? <div style={styles.radioDot} /> : null}
                  </div>
                </div>
                <div style={styles.planInfo}>
                  <div style={styles.planHeader}>
                    <span style={styles.planLabel}>{plan.label}</span>
                  </div>
                  <span style={styles.planDescription}>{plan.description}</span>
                </div>
                <div style={styles.planPrice}>
                  <span style={styles.priceAmount}>RM{plan.price}</span>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card style={styles.card}>
        <SectionHeader title={t("order.review.coupon")} />
        <div style={styles.couponRow}>
          <input
            value={couponCode}
            onChange={(event) => setCouponCode(event.target.value)}
            placeholder={t("order.review.enterCode")}
            style={styles.couponInput}
          />
          <Button title={t("order.review.apply")} variant="secondary" onClick={handleApplyCoupon} />
        </div>
        {couponApplied ? (
          <span style={styles.couponApplied}>{t("order.review.applied", { code: couponApplied })}</span>
        ) : (
          <span style={styles.couponHelper}>{t("order.review.couponHelper")}</span>
        )}
      </Card>

      <div style={styles.footerSpacer} />
      <div style={styles.footer}>
        <div style={styles.footerContent}>
          <Button
            title={t("order.review.continue", { price: selectedPlanDetails?.price ?? 0 })}
            onClick={handleContinue}
            fullWidth
          />
        </div>
      </div>
    </div>
  );
};

const createStyles = (theme: AppTheme) => ({
  page: {
    paddingBottom: 0,
    position: "relative" as const
  },
  backButton: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.sm,
    background: "transparent",
    border: "none",
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    padding: `${theme.spacing.sm}px 0`,
    marginBottom: theme.spacing.md,
    fontFamily: "inherit"
  },
  backArrow: {
    fontSize: 20,
    fontWeight: 700
  },
  heading: {
    fontSize: 28,
    fontWeight: 700,
    margin: 0,
    marginBottom: theme.spacing.xs,
    color: theme.colors.text
  },
  subheading: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    margin: 0,
    marginBottom: theme.spacing.xl,
    lineHeight: "22px"
  },
  card: {
    marginBottom: theme.spacing.lg
  },
  supplementList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.md
  },
  supplementItem: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    background: theme.colors.background,
    borderRadius: theme.radii.md,
    border: `1px solid ${theme.colors.divider}`
  },
  supplementIcon: {
    fontSize: 24,
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: theme.colors.surface,
    borderRadius: theme.radii.md
  },
  supplementInfo: {
    display: "flex",
    flexDirection: "column" as const,
    flex: 1
  },
  supplementName: {
    fontSize: 15,
    fontWeight: 600,
    color: theme.colors.text,
    marginBottom: 2
  },
  supplementDosage: {
    fontSize: 13,
    color: theme.colors.textSecondary
  },
  planList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.md
  },
  planOption: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    background: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 2,
    borderStyle: "solid",
    cursor: "pointer",
    transition: "all 0.2s ease",
    fontFamily: "inherit",
    textAlign: "left" as const,
    width: "100%"
  },
  radioContainer: {
    flexShrink: 0
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: "50%",
    border: `2px solid ${theme.colors.divider}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease"
  },
  radioSelected: {
    borderColor: theme.colors.primary
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: theme.colors.primary
  },
  planInfo: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    gap: 4
  },
  planHeader: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  planLabel: {
    fontSize: 15,
    fontWeight: 600,
    color: theme.colors.text
  },
  planDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary
  },
  planPrice: {
    display: "flex",
    alignItems: "baseline",
    gap: 2
  },
  priceAmount: {
    fontSize: 20,
    fontWeight: 700,
    color: theme.colors.text
  },
  couponRow: {
    display: "flex",
    gap: theme.spacing.sm,
    alignItems: "center"
  },
  couponInput: {
    flex: 1,
    padding: theme.spacing.md,
    fontSize: 15,
    borderRadius: theme.radii.md,
    border: `1px solid ${theme.colors.divider}`,
    background: theme.colors.background,
    color: theme.colors.text,
    fontFamily: "inherit"
  },
  couponHelper: {
    display: "block",
    marginTop: theme.spacing.xs,
    fontSize: 12,
    color: theme.colors.textSecondary
  },
  couponApplied: {
    display: "block",
    marginTop: theme.spacing.xs,
    fontSize: 12,
    color: theme.colors.success,
    fontWeight: 600
  },
  footerSpacer: {
    height: 120
  },
  footer: {
    position: "fixed" as const,
    bottom: 100,
    left: "50%",
    transform: "translateX(-50%)",
    width: `min(440px, calc(100% - ${theme.spacing.xl * 2}px))`,
    padding: 0,
    background: "transparent",
    zIndex: 10
  },
  footerContent: {
    padding: 0
  }
});

export default OrderReviewScreen;
