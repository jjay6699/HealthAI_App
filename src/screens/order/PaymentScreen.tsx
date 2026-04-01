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
}

const PaymentScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "fpx" | "ewallet">("card");
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

      if (paymentMethod === "card") {
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
          | { url?: string; error?: string }
          | null;

        if (!stripeResponse.ok || !stripePayload?.url) {
          throw new Error(stripePayload?.error || "Failed to start Stripe checkout");
        }

        window.location.assign(stripePayload.url);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 800));
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan: orderDetails?.plan,
          planLabel: orderDetails?.planLabel,
          price: orderDetails?.price,
          recommendations: orderDetails?.recommendations || [],
          couponCode: orderDetails?.couponCode || null,
          paymentMethod,
          deliveryAddress
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            order?: {
              orderNumber: string;
              date: string;
              plan: string;
              planLabel?: string;
              price: number;
              recommendations: any[];
              status: "processing";
            };
            error?: string;
          }
        | null;

      if (!response.ok || !payload?.order) {
        throw new Error(payload?.error || "Failed to save order");
      }

      const newOrder = payload.order;
      persistentStorage.setItem(scopedKey("lastOrder"), JSON.stringify(newOrder));

      const orderHistory = JSON.parse(
        persistentStorage.getItem(scopedKey("orderHistory")) ||
          persistentStorage.getItem("orderHistory") ||
          "[]"
      );
      orderHistory.unshift(newOrder);
      persistentStorage.setItem(scopedKey("orderHistory"), JSON.stringify(orderHistory));

      navigate("/order-confirmation");
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

  const paymentMethods = [
    { id: "card", icon: "💳", label: t("order.payment.card"), description: t("order.payment.cardDesc") },
    { id: "fpx", icon: "🏦", label: t("order.payment.fpx"), description: t("order.payment.fpxDesc") },
    { id: "ewallet", icon: "📱", label: t("order.payment.ewallet"), description: t("order.payment.ewalletDesc") }
  ];

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
        <div style={styles.summaryRow}>
          <span style={styles.summaryLabel}>{t("order.payment.shipping")}</span>
          <span style={styles.summaryValueFree}>{t("order.payment.free")}</span>
        </div>
        <div style={styles.divider} />
        <div style={styles.summaryRow}>
          <span style={styles.summaryLabelTotal}>{t("order.payment.total")}</span>
          <span style={styles.summaryValueTotal}>RM{orderDetails.price.toFixed(2)}</span>
        </div>
      </Card>

      <Card style={styles.card}>
        <SectionHeader title={t("order.payment.method")} />
        <div style={styles.paymentList}>
          {paymentMethods.map((method) => {
            const isSelected = paymentMethod === method.id;
            return (
              <button
                key={method.id}
                style={{
                  ...styles.paymentOption,
                  borderColor: isSelected ? theme.colors.primary : theme.colors.divider,
                  boxShadow: isSelected ? "0 2px 8px rgba(239, 68, 68, 0.1)" : "none"
                }}
                onClick={() => setPaymentMethod(method.id as typeof paymentMethod)}
              >
                <div style={styles.radioContainer}>
                  <div style={{ ...styles.radio, ...(isSelected ? styles.radioSelected : {}) }}>
                    {isSelected ? <div style={styles.radioDot} /> : null}
                  </div>
                </div>
                <div style={styles.paymentIcon}>{method.icon}</div>
                <div style={styles.paymentInfo}>
                  <span style={styles.paymentLabel}>{method.label}</span>
                  <span style={styles.paymentDescription}>{method.description}</span>
                </div>
              </button>
            );
          })}
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
            title={isProcessing ? t("order.payment.processing") : t("order.payment.complete", { price: orderDetails.price })}
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
  paymentOption: {
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
  paymentIcon: {
    fontSize: 28,
    flexShrink: 0
  },
  paymentInfo: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    gap: 2
  },
  paymentLabel: {
    fontSize: 15,
    fontWeight: 600,
    color: theme.colors.text
  },
  paymentDescription: {
    fontSize: 13,
    color: theme.colors.textSecondary
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
