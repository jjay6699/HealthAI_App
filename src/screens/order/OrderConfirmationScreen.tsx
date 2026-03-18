import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/Card";
import Button from "../../components/Button";
import { useI18n } from "../../i18n";
import { AppTheme, useTheme } from "../../theme";
import { persistentStorage } from "../../services/persistentStorage";

interface LastOrder {
  orderNumber: string;
  date: string;
  plan: string;
  planLabel?: string;
  price: number;
  recommendations: any[];
}

const OrderConfirmationScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { language, t } = useI18n();
  const navigate = useNavigate();
  const [order, setOrder] = useState<LastOrder | null>(null);

  useEffect(() => {
    const stored = persistentStorage.getItem("lastOrder");
    if (!stored) return;

    try {
      setOrder(JSON.parse(stored));
    } catch (error) {
      console.error("Failed to parse order:", error);
    }
  }, []);

  if (!order) {
    return (
      <div style={styles.page}>
        <h1 style={styles.heading}>{t("order.confirm.noOrder")}</h1>
        <Button title={t("order.confirm.goHome")} onClick={() => navigate("/")} />
      </div>
    );
  }

  const estimatedDelivery = new Date();
  estimatedDelivery.setDate(estimatedDelivery.getDate() + 5);

  return (
    <div style={styles.page}>
      <div style={styles.successContainer}>
        <div style={styles.checkmarkCircle}>
          <span style={styles.checkmark}>✓</span>
        </div>
        <h1 style={styles.successTitle}>{t("order.confirm.success")}</h1>
        <p style={styles.successText}>{t("order.confirm.successBody")}</p>
      </div>

      <Card style={styles.card}>
        <div style={styles.orderHeader}>
          <div>
            <p style={styles.orderLabel}>{t("order.confirm.orderNumber")}</p>
            <p style={styles.orderNumber}>#{order.orderNumber}</p>
          </div>
          <div style={styles.estimatedDelivery}>
            <p style={styles.deliveryLabel}>{t("order.confirm.estimatedDelivery")}</p>
            <p style={styles.deliveryDate}>
              {estimatedDelivery.toLocaleDateString(language === "zh" ? "zh-CN" : language === "bm" ? "ms-MY" : "en-MY", {
                day: "numeric",
                month: "short",
                year: "numeric"
              })}
            </p>
          </div>
        </div>
      </Card>

      <Card style={styles.card}>
        <h3 style={styles.cardTitle}>{t("order.confirm.summary")}</h3>
        <div style={styles.summaryRow}>
          <span style={styles.summaryLabel}>{t("order.confirm.customBlend", { plan: order.planLabel || order.plan })}</span>
          <span style={styles.summaryValue}>RM{order.price.toFixed(2)}</span>
        </div>
        <div style={styles.summaryRow}>
          <span style={styles.summaryLabel}>{t("order.confirm.shipping")}</span>
          <span style={styles.summaryValueFree}>{t("order.confirm.free")}</span>
        </div>
        <div style={styles.divider} />
        <div style={styles.summaryRow}>
          <span style={styles.summaryLabelTotal}>{t("order.confirm.totalPaid")}</span>
          <span style={styles.summaryValueTotal}>RM{order.price.toFixed(2)}</span>
        </div>
      </Card>

      <Card style={styles.card}>
        <h3 style={styles.cardTitle}>{t("order.confirm.whatsNext")}</h3>
        <div style={styles.stepsList}>
          <div style={styles.step}>
            <div style={styles.stepIcon}>📧</div>
            <div style={styles.stepContent}>
              <p style={styles.stepTitle}>{t("order.confirm.confirmationEmail")}</p>
              <p style={styles.stepText}>{t("order.confirm.confirmationEmailBody")}</p>
            </div>
          </div>
          <div style={styles.step}>
            <div style={styles.stepIcon}>📦</div>
            <div style={styles.stepContent}>
              <p style={styles.stepTitle}>{t("order.confirm.preparingBlend")}</p>
              <p style={styles.stepText}>{t("order.confirm.preparingBlendBody")}</p>
            </div>
          </div>
          <div style={styles.step}>
            <div style={styles.stepIcon}>🚚</div>
            <div style={styles.stepContent}>
              <p style={styles.stepTitle}>{t("order.confirm.shippingUpdates")}</p>
              <p style={styles.stepText}>{t("order.confirm.shippingUpdatesBody")}</p>
            </div>
          </div>
          <div style={styles.step}>
            <div style={styles.stepIcon}>🏠</div>
            <div style={styles.stepContent}>
              <p style={styles.stepTitle}>{t("order.confirm.delivery")}</p>
              <p style={styles.stepText}>{t("order.confirm.deliveryBody")}</p>
            </div>
          </div>
        </div>
      </Card>

      <div style={styles.buttonGroup}>
        <Button title={t("order.confirm.trackOrder")} onClick={() => navigate("/history")} fullWidth />
        <Button
          title={t("order.confirm.backHome")}
          onClick={() => navigate("/")}
          fullWidth
          style={{ background: theme.colors.background, color: theme.colors.text }}
        />
      </div>
    </div>
  );
};

const createStyles = (theme: AppTheme) => ({
  page: {
    paddingBottom: 80,
    position: "relative" as const
  },
  heading: {
    fontSize: 24,
    fontWeight: 700,
    color: theme.colors.text,
    textAlign: "center" as const,
    marginBottom: theme.spacing.lg
  },
  successContainer: {
    textAlign: "center" as const,
    padding: `${theme.spacing.xl}px 0`,
    marginBottom: theme.spacing.lg
  },
  checkmarkCircle: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    background: "#10B981",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto",
    marginBottom: theme.spacing.lg,
    animation: "scaleIn 0.5s ease-out"
  },
  checkmark: {
    fontSize: 48,
    color: "#FFFFFF",
    fontWeight: 700
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: theme.colors.text,
    margin: 0,
    marginBottom: theme.spacing.sm
  },
  successText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    margin: 0,
    lineHeight: "22px",
    maxWidth: 320,
    marginLeft: "auto",
    marginRight: "auto"
  },
  card: {
    marginBottom: theme.spacing.lg
  },
  orderHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: theme.spacing.md
  },
  orderLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    margin: 0,
    marginBottom: 4
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: 700,
    color: theme.colors.text,
    margin: 0
  },
  estimatedDelivery: {
    textAlign: "right" as const
  },
  deliveryLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    margin: 0,
    marginBottom: 4
  },
  deliveryDate: {
    fontSize: 15,
    fontWeight: 600,
    color: theme.colors.success,
    margin: 0
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: theme.colors.text,
    margin: 0,
    marginBottom: theme.spacing.md
  },
  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.sm
  },
  summaryLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 600,
    color: theme.colors.text
  },
  summaryValueFree: {
    fontSize: 14,
    fontWeight: 600,
    color: theme.colors.success
  },
  summaryLabelTotal: {
    fontSize: 16,
    fontWeight: 700,
    color: theme.colors.text
  },
  summaryValueTotal: {
    fontSize: 20,
    fontWeight: 700,
    color: theme.colors.text
  },
  divider: {
    height: 1,
    background: theme.colors.divider,
    margin: `${theme.spacing.md}px 0`
  },
  stepsList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.md
  },
  step: {
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing.md
  },
  stepIcon: {
    fontSize: 24,
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: theme.colors.background,
    borderRadius: theme.radii.md,
    flexShrink: 0
  },
  stepContent: {
    flex: 1
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: theme.colors.text,
    margin: 0,
    marginBottom: 2
  },
  stepText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    margin: 0
  },
  buttonGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.md
  }
});

export default OrderConfirmationScreen;
