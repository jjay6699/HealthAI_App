import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/Card";
import Button from "../../components/Button";
import SectionHeader from "../../components/SectionHeader";
import { AppTheme, useTheme } from "../../theme";
import { BloodworkAnalysis } from "../../services/openai";

const OrderReviewScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<"one-bottle" | "one-month" | "three-months">("one-month");
  const [analysis, setAnalysis] = useState<BloodworkAnalysis | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<string | null>(null);

  useEffect(() => {
    const storedAnalysis = localStorage.getItem("bloodworkAnalysis");
    if (storedAnalysis) {
      try {
        setAnalysis(JSON.parse(storedAnalysis));
      } catch (error) {
        console.error("Failed to parse analysis:", error);
      }
    }
  }, []);

  const plans = [
    { id: "one-bottle", label: "One Bottle Order", price: 45, savings: null, description: "1 bottle" },
    { id: "one-month", label: "One Month Order", price: 85, savings: null, description: "2 bottles" },
    { id: "three-months", label: "3-Months Order", price: 240, savings: null, description: "6 bottles" }
  ];

  const selectedPlanDetails = plans.find(p => p.id === selectedPlan);

  const handleContinue = () => {
    // Save order details to localStorage
    localStorage.setItem("orderDetails", JSON.stringify({
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
        <h1 style={styles.heading}>No recommendations found</h1>
        <p style={styles.subheading}>Please complete a bloodwork analysis first.</p>
        <Button title="Upload Bloodwork" onClick={() => navigate("/upload")} />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Back Button */}
      <button onClick={() => navigate("/supplements")} style={styles.backButton}>
        <span style={styles.backArrow}>←</span>
        <span>Back to Nutrition</span>
      </button>

      <h1 style={styles.heading}>Review Your Order</h1>
      <p style={styles.subheading}>Choose your plan and confirm your custom nutrition blend</p>

      {/* Custom Blend Summary */}
      <Card style={styles.card}>
        <SectionHeader title="Your Custom Blend" />
        <div style={styles.supplementList}>
          {analysis.recommendations.map((rec, index) => (
            <div key={index} style={styles.supplementItem}>
              <div style={styles.supplementIcon}>💊</div>
              <div style={styles.supplementInfo}>
                <span style={styles.supplementName}>{rec.supplementName}</span>
                <span style={styles.supplementDosage}>{(rec.dosage || "").replace(/per day/gi, "per serving size").replace(/g\/day/gi, "g per serving size")}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Plan Selection */}
      <Card style={styles.card}>
        <SectionHeader title="Choose Your Plan" />
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
                onClick={() => setSelectedPlan(plan.id as any)}
              >
              <div style={styles.radioContainer}>
                <div style={{
                  ...styles.radio,
                  ...(selectedPlan === plan.id ? styles.radioSelected : {})
                }}>
                  {selectedPlan === plan.id && <div style={styles.radioDot} />}
                </div>
              </div>
              <div style={styles.planInfo}>
                <div style={styles.planHeader}>
                  <span style={styles.planLabel}>{plan.label}</span>
                  {plan.savings && (
                    <span style={styles.savingsBadge}>Save {plan.savings}%</span>
                  )}
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
        <SectionHeader title="Coupon code" />
        <div style={styles.couponRow}>
          <input
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            placeholder="Enter code"
            style={styles.couponInput}
          />
          <Button title="Apply" variant="secondary" onClick={handleApplyCoupon} />
        </div>
        {couponApplied ? (
          <span style={styles.couponApplied}>Applied: {couponApplied}</span>
        ) : (
          <span style={styles.couponHelper}>You can apply a promo code at checkout.</span>
        )}
      </Card>

      {/* Continue Button */}
      <div style={styles.footerSpacer} />
      <div style={styles.footer}>
        <div style={styles.footerContent}>
          <Button
            title={`Continue to Checkout - RM${selectedPlanDetails?.price}`}
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
  savingsBadge: {
    fontSize: 11,
    fontWeight: 600,
    color: theme.colors.success,
    background: "#F0FDF4",
    padding: "2px 8px",
    borderRadius: theme.radii.sm,
    border: `1px solid ${theme.colors.success}`
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
  priceFrequency: {
    fontSize: 13,
    color: theme.colors.textSecondary
  },
  select: {
    width: "100%",
    padding: theme.spacing.md,
    fontSize: 15,
    borderRadius: theme.radii.md,
    border: `1px solid ${theme.colors.divider}`,
    background: theme.colors.background,
    color: theme.colors.text,
    fontFamily: "inherit",
    cursor: "pointer"
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

