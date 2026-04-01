import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/Card";
import Button from "../../components/Button";
import SectionHeader from "../../components/SectionHeader";
import { useI18n } from "../../i18n";
import { AppTheme, useTheme } from "../../theme";
import { persistentStorage } from "../../services/persistentStorage";
import { useAuth } from "../../services/auth";

type OrderRecommendation = {
  supplementName?: string;
  dosage?: string;
};

type DeliveryAddress = {
  fullName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postcode?: string;
};

type OrderRecord = {
  orderNumber: string;
  date: string;
  plan: string;
  planLabel?: string;
  price: number;
  status?: string;
  paymentMethod?: string;
  couponCode?: string | null;
  recommendations?: OrderRecommendation[];
  deliveryAddress?: DeliveryAddress | null;
};

const OrdersScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { language } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string | null>(null);

  const scopedKey = (baseKey: string) => (user?.id ? `${baseKey}:${user.id}` : baseKey);
  const locale = language === "zh" ? "zh-CN" : language === "bm" ? "ms-MY" : "en-MY";

  useEffect(() => {
    const stored =
      persistentStorage.getItem(scopedKey("orderHistory")) ??
      persistentStorage.getItem("orderHistory");
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setOrders(parsed);
        if (parsed.length > 0) {
          setSelectedOrderNumber(parsed[0].orderNumber);
        }
      }
    } catch (error) {
      console.error("Failed to parse order history:", error);
    }
  }, [user?.id]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.orderNumber === selectedOrderNumber) || orders[0] || null,
    [orders, selectedOrderNumber]
  );

  const formatDate = (value?: string) => {
    if (!value) return "Unknown date";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown date";
    return date.toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  const formatStatus = (status?: string) => {
    switch (status) {
      case "paid":
        return "Paid";
      case "processing":
        return "Processing";
      case "shipped":
        return "Shipped";
      case "delivered":
        return "Delivered";
      case "cancelled":
        return "Cancelled";
      default:
        return "In progress";
    }
  };

  const getStatusStyle = (status?: string) => {
    switch (status) {
      case "paid":
      case "delivered":
        return { background: "#ECFDF5", color: "#047857" };
      case "processing":
      case "shipped":
        return { background: "#EFF6FF", color: "#1D4ED8" };
      case "cancelled":
        return { background: "#FEF2F2", color: "#B91C1C" };
      default:
        return { background: "#F3F4F6", color: "#374151" };
    }
  };

  if (orders.length === 0) {
    return (
      <div style={styles.page}>
        <button onClick={() => navigate("/profile")} style={styles.backButton}>
          <span style={styles.backArrow}>←</span>
          <span>Back to profile</span>
        </button>

        <h1 style={styles.heading}>Your orders</h1>
        <p style={styles.subheading}>Track confirmed purchases, review delivery details, and revisit your blend summary.</p>

        <Card style={styles.emptyCard}>
          <h3 style={styles.emptyTitle}>No orders yet</h3>
          <p style={styles.emptyBody}>Once you place an order, it will appear here with the status, total, and blend details.</p>
          <Button title="Start a new order" onClick={() => navigate("/supplements")} fullWidth />
        </Card>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <button onClick={() => navigate("/profile")} style={styles.backButton}>
        <span style={styles.backArrow}>←</span>
        <span>Back to profile</span>
      </button>

      <h1 style={styles.heading}>Your orders</h1>
      <p style={styles.subheading}>Track confirmed purchases, review delivery details, and revisit your blend summary.</p>

      <Card style={styles.summaryCard}>
        <div style={styles.summaryMetric}>
          <span style={styles.metricLabel}>Total orders</span>
          <strong style={styles.metricValue}>{orders.length}</strong>
        </div>
        <div style={styles.summaryMetric}>
          <span style={styles.metricLabel}>Latest order</span>
          <strong style={styles.metricValue}>{selectedOrder ? `#${selectedOrder.orderNumber}` : "-"}</strong>
        </div>
      </Card>

      <Card style={styles.card}>
        <SectionHeader title="Order history" />
        <div style={styles.orderList}>
          {orders.map((order) => {
            const isSelected = order.orderNumber === selectedOrder?.orderNumber;
            return (
              <button
                key={order.orderNumber}
                type="button"
                onClick={() => setSelectedOrderNumber(order.orderNumber)}
                style={{
                  ...styles.orderRow,
                  ...(isSelected ? styles.orderRowSelected : {})
                }}
              >
                <div style={styles.orderRowMain}>
                  <strong style={styles.orderNumber}>#{order.orderNumber}</strong>
                  <span style={styles.orderMeta}>{formatDate(order.date)} • {order.planLabel || order.plan}</span>
                </div>
                <div style={styles.orderRowAside}>
                  <strong style={styles.orderPrice}>RM{Number(order.price).toFixed(2)}</strong>
                  <span style={{ ...styles.orderStatus, ...getStatusStyle(order.status) }}>{formatStatus(order.status)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {selectedOrder ? (
        <Card style={styles.card}>
          <SectionHeader title="Order details" />
          <div style={styles.detailsGrid}>
            <div>
              <span style={styles.detailLabel}>Order number</span>
              <p style={styles.detailValue}>#{selectedOrder.orderNumber}</p>
            </div>
            <div>
              <span style={styles.detailLabel}>Placed on</span>
              <p style={styles.detailValue}>{formatDate(selectedOrder.date)}</p>
            </div>
            <div>
              <span style={styles.detailLabel}>Plan</span>
              <p style={styles.detailValue}>{selectedOrder.planLabel || selectedOrder.plan}</p>
            </div>
            <div>
              <span style={styles.detailLabel}>Payment</span>
              <p style={styles.detailValue}>{selectedOrder.paymentMethod || "Not recorded"}</p>
            </div>
            <div>
              <span style={styles.detailLabel}>Status</span>
              <p style={styles.detailValue}>{formatStatus(selectedOrder.status)}</p>
            </div>
            <div>
              <span style={styles.detailLabel}>Total</span>
              <p style={styles.detailValue}>RM{Number(selectedOrder.price).toFixed(2)}</p>
            </div>
          </div>

          {selectedOrder.couponCode ? (
            <div style={styles.detailSection}>
              <span style={styles.detailLabel}>Referral or coupon code</span>
              <p style={styles.detailValue}>{selectedOrder.couponCode}</p>
            </div>
          ) : null}

          {selectedOrder.deliveryAddress ? (
            <div style={styles.detailSection}>
              <span style={styles.detailLabel}>Delivery address</span>
              <p style={styles.addressText}>
                {selectedOrder.deliveryAddress.fullName || ""}
                <br />
                {selectedOrder.deliveryAddress.phone || ""}
                <br />
                {selectedOrder.deliveryAddress.addressLine1 || ""}
                {selectedOrder.deliveryAddress.addressLine2 ? <><br />{selectedOrder.deliveryAddress.addressLine2}</> : null}
                <br />
                {selectedOrder.deliveryAddress.postcode || ""} {selectedOrder.deliveryAddress.city || ""}
                <br />
                {selectedOrder.deliveryAddress.state || ""}
              </p>
            </div>
          ) : null}

          <div style={styles.detailSection}>
            <span style={styles.detailLabel}>Blend items</span>
            {selectedOrder.recommendations && selectedOrder.recommendations.length > 0 ? (
              <div style={styles.recommendationList}>
                {selectedOrder.recommendations.map((item, index) => (
                  <div key={`${selectedOrder.orderNumber}-item-${index}`} style={styles.recommendationItem}>
                    <strong style={styles.recommendationName}>{item.supplementName || "Supplement"}</strong>
                    {item.dosage ? <span style={styles.recommendationDose}>{item.dosage}</span> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p style={styles.mutedText}>No blend details were stored for this order.</p>
            )}
          </div>

          <div style={styles.actions}>
            <Button title="Order again" onClick={() => navigate("/supplements")} fullWidth />
          </div>
        </Card>
      ) : null}
    </div>
  );
};

const createStyles = (theme: AppTheme) => ({
  page: {
    paddingBottom: 80
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
  summaryCard: {
    marginBottom: theme.spacing.lg,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: theme.spacing.md
  },
  summaryMetric: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4
  },
  metricLabel: {
    fontSize: 12,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: theme.colors.textSecondary
  },
  metricValue: {
    fontSize: 20,
    color: theme.colors.text
  },
  orderList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.sm
  },
  orderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radii.lg,
    border: `1px solid ${theme.colors.divider}`,
    background: "#fff",
    cursor: "pointer",
    textAlign: "left" as const
  },
  orderRowSelected: {
    borderColor: theme.colors.primary,
    boxShadow: "0 8px 24px rgba(197, 138, 74, 0.12)"
  },
  orderRowMain: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
    minWidth: 0
  },
  orderRowAside: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-end" as const,
    gap: 8
  },
  orderNumber: {
    fontSize: 16,
    color: theme.colors.text
  },
  orderMeta: {
    fontSize: 13,
    color: theme.colors.textSecondary
  },
  orderPrice: {
    fontSize: 16,
    color: theme.colors.text
  },
  orderStatus: {
    fontSize: 12,
    fontWeight: 700,
    padding: "6px 10px",
    borderRadius: theme.radii.pill
  },
  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg
  },
  detailSection: {
    paddingTop: theme.spacing.md,
    borderTop: `1px solid ${theme.colors.divider}`,
    marginTop: theme.spacing.md
  },
  detailLabel: {
    display: "block",
    fontSize: 12,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: theme.colors.textSecondary,
    marginBottom: 6
  },
  detailValue: {
    margin: 0,
    fontSize: 16,
    color: theme.colors.text,
    lineHeight: "24px"
  },
  addressText: {
    margin: 0,
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: "24px"
  },
  recommendationList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.sm
  },
  recommendationItem: {
    padding: theme.spacing.md,
    background: theme.colors.background,
    borderRadius: theme.radii.md,
    border: `1px solid ${theme.colors.divider}`,
    display: "flex",
    flexDirection: "column" as const,
    gap: 4
  },
  recommendationName: {
    fontSize: 15,
    color: theme.colors.text
  },
  recommendationDose: {
    fontSize: 13,
    color: theme.colors.textSecondary
  },
  mutedText: {
    margin: 0,
    fontSize: 14,
    color: theme.colors.textSecondary
  },
  emptyCard: {
    textAlign: "center" as const
  },
  emptyTitle: {
    margin: 0,
    marginBottom: theme.spacing.sm,
    fontSize: 22,
    color: theme.colors.text
  },
  emptyBody: {
    margin: 0,
    marginBottom: theme.spacing.lg,
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: "22px"
  },
  actions: {
    marginTop: theme.spacing.xl
  }
});

export default OrdersScreen;
