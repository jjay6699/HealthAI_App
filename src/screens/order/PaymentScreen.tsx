import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/Card";
import Button from "../../components/Button";
import SectionHeader from "../../components/SectionHeader";
import { useI18n } from "../../i18n";
import { AppTheme, useTheme } from "../../theme";
import { persistentStorage } from "../../services/persistentStorage";
import { useAuth } from "../../services/auth";

interface OrderDetails {
  plan: string;
  planLabel?: string;
  price: number;
  recommendations: any[];
  couponCode?: string | null;
  couponPreview?: {
    subtotal: number;
    discountAmount: number;
    total: number;
    currency: string;
  } | null;
}

const PaymentScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const scopedKey = (baseKey: string) => (user?.id ? `${baseKey}:${user.id}` : baseKey);

  useEffect(() => {
    const stored = persistentStorage.getItem("orderDetails");
    if (!stored) return;

    try {
      setOrderDetails(JSON.parse(stored));
    } catch (error) {
      console.error("Failed to parse order details:", error);
    }
  }, []);

  const handleCompleteOrder = async () => {
    setIsProcessing(true);
    try {
      const deliveryAddressRaw = persistentStorage.getItem("deliveryAddress");
      const deliveryAddress = deliveryAddressRaw ? JSON.parse(deliveryAddressRaw) : null;

      // Always go through Stripe Checkout. Stripe will automatically
      // display the payment methods enabled in your Stripe dashboard.
      const stripeResponse = await fetch("/api/stripe/checkout-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan: orderDetails?.plan,
          planLabel: orderDetails?.planLabel,
          price: orderDetails?.price,
          recommendations: orderDetails?.recommendations || [],
          couponCode: orderDetails?.couponCode || null,
          deliveryAddress
        })
      });

      const stripePayload = (await stripeResponse.json().catch(() => null)) as
        | { url?: string; error?: string; message?: string }
        | null;

      if (!stripeResponse.ok || !stripePayload?.url) {
        const errMessage =
          stripePayload?.message || stripePayload?.error || "Failed to start Stripe checkout";
        throw new Error(errMessage);
      }

      window.location.assign(stripePayload.url);
      return;
    } catch (error) {
      console.error("Failed to complete order:", error);
      alert("Unable to complete your order right now. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!orderDetails) {
    return (
      <div style={styles.page}>
        <h1 style={styles.heading}>{t("order.payment.noOrder")}</h1>
        <p style={styles.subheading}>{t("order.payment.noOrderBody")}</p>
        <Button title={t("order.payment.backToCheckout")} onClick={() => navigate("/checkout")} />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <button onClick={() => navigate("/checkout")} style={styles.backButton}>
        <span style={styles.backArrow}>←</span>
        <span>{t("order.payment.backToCheckout")}</span>
      </button>

      <h1 style={styles.heading}>{t("order.payment.heading")}</h1>
      <p style={styles.subheading}>{t("order.payment.subheading")}</p>

      <Card style={styles.card}>
        <SectionHeader title={t("order.payment.summary")} />
        <div style={styles.summaryRow}>
          <span style={styles.summaryLabel}>
            {t("order.payment.customBlend", { plan: orderDetails.planLabel || orderDetails.plan })}
          </span>
          <span style={styles.summaryValue}>RM{orderDetails.price.toFixed(2)}</span>
        </div>
        {orderDetails.couponPreview ? (
          <div style={styles.summaryRow}>
            <span style={styles.summaryLabel}>{t("order.summary.discount")}</span>
            <span style={styles.summaryValueDiscount}>-RM{orderDetails.couponPreview.discountAmount.toFixed(2)}</span>
          </div>
        ) : null}
        <div style={styles.summaryRow}>
          <span style={styles.summaryLabel}>{t("order.payment.shipping")}</span>
          <span style={styles.summaryValueFree}>{t("order.payment.free")}</span>
        </div>
        <div style={styles.divider} />
        <div style={styles.summaryRow}>
          <span style={styles.summaryLabelTotal}>{t("order.payment.total")}</span>
          <span style={styles.summaryValueTotal}>
            RM{(orderDetails.couponPreview?.total ?? orderDetails.price).toFixed(2)}
          </span>
        </div>
      </Card>

      <Card style={styles.card}>
        <SectionHeader title={t("order.payment.method")} />
        <div style={styles.paymentList}>
          <div style={styles.stripeNotice}>
            <div style={styles.stripeNoticeTitle}>{t("order.payment.stripeTitle")}</div>
            <div style={styles.stripeNoticeBody}>{t("order.payment.stripeBody")}</div>
          </div>
        </div>
      </Card>

      <Card style={styles.securityCard}>
        <div style={styles.securityContent}>
          <span style={styles.securityIcon}>🔒</span>
          <div>
            <p style={styles.securityTitle}>{t("order.payment.secureTitle")}</p>
            <p style={styles.securityText}>{t("order.payment.secureBody")}</p>
          </div>
        </div>
      </Card>

      <div style={styles.footerSpacer} />
      <div style={styles.footer}>
        <div style={styles.footerContent}>
          <Button
            title={
              isProcessing
                ? t("order.payment.processing")
                : t("order.payment.complete", { price: orderDetails.couponPreview?.total ?? orderDetails.price })
            }
            onClick={handleCompleteOrder}
            loading={isProcessing}
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
  summaryValueDiscount: {
    fontSize: 14,
    fontWeight: 600,
    color: theme.colors.danger
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
  paymentList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.md
  },
  stripeNotice: {
    borderRadius: theme.radii.lg,
    border: `1px solid ${theme.colors.divider}`,
    background: theme.colors.background,
    padding: theme.spacing.md
  },
  stripeNoticeTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: theme.colors.text,
    marginBottom: 4
  },
  stripeNoticeBody: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: "18px"
  },
  securityCard: {
    background: "#F0FDF4",
    border: `1px solid ${theme.colors.success}`,
    marginBottom: theme.spacing.lg
  },
  securityContent: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.md
  },
  securityIcon: {
    fontSize: 24
  },
  securityTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: theme.colors.text,
    margin: 0,
    marginBottom: 2
  },
  securityText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    margin: 0
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

export default PaymentScreen;
