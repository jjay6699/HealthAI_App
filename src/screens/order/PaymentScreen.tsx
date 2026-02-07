import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/Card";
import Button from "../../components/Button";
import SectionHeader from "../../components/SectionHeader";
import { AppTheme, useTheme } from "../../theme";

interface OrderDetails {
  plan: string;
  planLabel?: string;
  price: number;
  recommendations: any[];
}

const PaymentScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "fpx" | "ewallet">("card");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("orderDetails");
    if (stored) {
      try {
        setOrderDetails(JSON.parse(stored));
      } catch (error) {
        console.error("Failed to parse order details:", error);
      }
    }
  }, []);

  const handleCompleteOrder = async () => {
    setIsProcessing(true);

    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate order number
    const orderNumber = `NG${Date.now().toString().slice(-8)}`;

    const newOrder = {
      orderNumber,
      date: new Date().toISOString(),
      ...orderDetails,
      status: "processing" as const
    };

    // Save order confirmation
    localStorage.setItem("lastOrder", JSON.stringify(newOrder));

    // Add to order history
    const orderHistory = JSON.parse(localStorage.getItem("orderHistory") || "[]");
    orderHistory.unshift(newOrder); // Add to beginning of array
    localStorage.setItem("orderHistory", JSON.stringify(orderHistory));

    // Navigate to confirmation
    navigate("/order-confirmation");
  };

  if (!orderDetails) {
    return (
      <div style={styles.page}>
        <h1 style={styles.heading}>No order found</h1>
        <p style={styles.subheading}>Please complete checkout first.</p>
        <Button title="Back to Checkout" onClick={() => navigate("/checkout")} />
      </div>
    );
  }

  const paymentMethods = [
    { id: "card", icon: "💳", label: "Credit / Debit Card", description: "Visa, Mastercard, Amex" },
    { id: "fpx", icon: "🏦", label: "FPX Online Banking", description: "All Malaysian banks" },
    { id: "ewallet", icon: "📱", label: "E-Wallet", description: "Touch 'n Go, GrabPay" }
  ];

  return (
    <div style={styles.page}>
      {/* Back Button */}
      <button onClick={() => navigate("/checkout")} style={styles.backButton}>
        <span style={styles.backArrow}>←</span>
        <span>Back to Checkout</span>
      </button>

      <h1 style={styles.heading}>Payment</h1>
      <p style={styles.subheading}>Choose your payment method</p>

      {/* Order Summary */}
      <Card style={styles.card}>
        <SectionHeader title="Order Summary" />
        <div style={styles.summaryRow}>
          <span style={styles.summaryLabel}>
            Custom Blend ({orderDetails.planLabel || orderDetails.plan})
          </span>
          <span style={styles.summaryValue}>RM{orderDetails.price.toFixed(2)}</span>
        </div>
        <div style={styles.summaryRow}>
          <span style={styles.summaryLabel}>Shipping</span>
          <span style={styles.summaryValueFree}>FREE</span>
        </div>
        <div style={styles.divider} />
        <div style={styles.summaryRow}>
          <span style={styles.summaryLabelTotal}>Total</span>
          <span style={styles.summaryValueTotal}>RM{orderDetails.price.toFixed(2)}</span>
        </div>
      </Card>

      {/* Payment Method Selection */}
      <Card style={styles.card}>
        <SectionHeader title="Payment Method" />
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
                onClick={() => setPaymentMethod(method.id as any)}
              >
              <div style={styles.radioContainer}>
                <div style={{
                  ...styles.radio,
                  ...(paymentMethod === method.id ? styles.radioSelected : {})
                }}>
                  {paymentMethod === method.id && <div style={styles.radioDot} />}
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

      {/* Security Notice */}
      <Card style={styles.securityCard}>
        <div style={styles.securityContent}>
          <span style={styles.securityIcon}>🔒</span>
          <div>
            <p style={styles.securityTitle}>Secure Payment</p>
            <p style={styles.securityText}>Your payment information is encrypted and secure</p>
          </div>
        </div>
      </Card>

      {/* Complete Order Button */}
      <div style={styles.footerSpacer} />
      <div style={styles.footer}>
        <div style={styles.footerContent}>
          <Button
            title={isProcessing ? "Processing..." : `Complete Order - RM${orderDetails.price}`}
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
