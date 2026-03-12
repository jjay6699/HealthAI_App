import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/Card";
import Button from "../../components/Button";
import SectionHeader from "../../components/SectionHeader";
import { useI18n } from "../../i18n";
import { AppTheme, useTheme } from "../../theme";
import { persistentStorage } from "../../services/persistentStorage";

interface OrderDetails {
  plan: string;
  planLabel?: string;
  price: number;
  recommendations: any[];
}

const CheckoutScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const navigate = useNavigate();
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    postcode: "",
    state: "",
    specialInstructions: ""
  });

  useEffect(() => {
    const stored = persistentStorage.getItem("orderDetails");
    if (stored) {
      try {
        setOrderDetails(JSON.parse(stored));
      } catch (error) {
        console.error("Failed to parse order details:", error);
      }
    }

    const savedAddress = persistentStorage.getItem("deliveryAddress");
    if (savedAddress) {
      try {
        setFormData((prev) => ({ ...prev, ...JSON.parse(savedAddress) }));
      } catch (error) {
        console.error("Failed to parse saved address:", error);
      }
    }
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleContinue = () => {
    if (!formData.fullName || !formData.phone || !formData.addressLine1 || !formData.city || !formData.postcode || !formData.state) {
      alert(t("order.checkout.requiredFields"));
      return;
    }

    persistentStorage.setItem("deliveryAddress", JSON.stringify(formData));

    const shippingAddresses = JSON.parse(persistentStorage.getItem("shippingAddresses") || "[]");
    const addressExists = shippingAddresses.some((address: any) =>
      address.addressLine1 === formData.addressLine1 && address.postcode === formData.postcode
    );

    if (!addressExists) {
      shippingAddresses.push({
        id: `addr_${Date.now()}`,
        ...formData,
        isDefault: shippingAddresses.length === 0
      });
      persistentStorage.setItem("shippingAddresses", JSON.stringify(shippingAddresses));
    }

    navigate("/payment");
  };

  if (!orderDetails) {
    return (
      <div style={styles.page}>
        <h1 style={styles.heading}>{t("order.checkout.noOrder")}</h1>
        <p style={styles.subheading}>{t("order.checkout.noOrderBody")}</p>
        <Button title={t("order.checkout.backToReview")} onClick={() => navigate("/order-review")} />
      </div>
    );
  }

  const malaysianStates = [
    "Johor", "Kedah", "Kelantan", "Kuala Lumpur", "Labuan", "Malacca", "Negeri Sembilan",
    "Pahang", "Penang", "Perak", "Perlis", "Putrajaya", "Sabah", "Sarawak", "Selangor", "Terengganu"
  ];

  return (
    <div style={styles.page}>
      <button onClick={() => navigate("/order-review")} style={styles.backButton}>
        <span style={styles.backArrow}>←</span>
        <span>{t("order.checkout.backToCart")}</span>
      </button>

      <h1 style={styles.heading}>{t("order.checkout.heading")}</h1>
      <p style={styles.subheading}>{t("order.checkout.subheading")}</p>

      <Card style={styles.card}>
        <SectionHeader title={t("order.checkout.deliveryAddress")} />

        <div style={styles.formGroup}>
          <label style={styles.label}>{t("order.checkout.fullName")}</label>
          <input
            type="text"
            value={formData.fullName}
            onChange={(event) => handleInputChange("fullName", event.target.value)}
            placeholder="John Doe"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>{t("order.checkout.phone")}</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(event) => handleInputChange("phone", event.target.value)}
            placeholder="+60 12-345 6789"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>{t("order.checkout.address1")}</label>
          <input
            type="text"
            value={formData.addressLine1}
            onChange={(event) => handleInputChange("addressLine1", event.target.value)}
            placeholder="Street address, P.O. box"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>{t("order.checkout.address2")}</label>
          <input
            type="text"
            value={formData.addressLine2}
            onChange={(event) => handleInputChange("addressLine2", event.target.value)}
            placeholder="Apartment, suite, unit, building, floor, etc."
            style={styles.input}
          />
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>{t("order.checkout.city")}</label>
            <input
              type="text"
              value={formData.city}
              onChange={(event) => handleInputChange("city", event.target.value)}
              placeholder="Kuala Lumpur"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t("order.checkout.postcode")}</label>
            <input
              type="text"
              value={formData.postcode}
              onChange={(event) => handleInputChange("postcode", event.target.value)}
              placeholder="50000"
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>{t("order.checkout.state")}</label>
          <select
            value={formData.state}
            onChange={(event) => handleInputChange("state", event.target.value)}
            style={styles.select}
          >
            <option value="">{t("order.checkout.selectState")}</option>
            {malaysianStates.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>{t("order.checkout.instructions")}</label>
          <textarea
            value={formData.specialInstructions}
            onChange={(event) => handleInputChange("specialInstructions", event.target.value)}
            placeholder="Any special delivery instructions..."
            style={styles.textarea}
            rows={3}
          />
        </div>
      </Card>

      <Card style={styles.card}>
        <SectionHeader title={t("order.checkout.summary")} />
        <div style={styles.summaryRow}>
          <span style={styles.summaryLabel}>
            {t("order.checkout.items", {
              count: orderDetails.recommendations.length,
              plan: orderDetails.planLabel || orderDetails.plan
            })}
          </span>
          <span style={styles.summaryValue}>RM{orderDetails.price.toFixed(2)}</span>
        </div>
        <div style={styles.summaryRow}>
          <span style={styles.summaryLabel}>{t("order.checkout.shipping")}</span>
          <span style={styles.summaryValueFree}>{t("order.checkout.free")}</span>
        </div>
        <div style={styles.divider} />
        <div style={styles.summaryRow}>
          <span style={styles.summaryLabelTotal}>{t("order.checkout.total")}</span>
          <span style={styles.summaryValueTotal}>RM{orderDetails.price.toFixed(2)}</span>
        </div>
      </Card>

      <div style={styles.footerSpacer} />
      <div style={styles.footer}>
        <div style={styles.footerContent}>
          <Button title={t("order.checkout.continue")} onClick={handleContinue} fullWidth />
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
  formGroup: {
    marginBottom: theme.spacing.md,
    flex: 1
  },
  formRow: {
    display: "flex",
    gap: theme.spacing.md
  },
  label: {
    display: "block",
    fontSize: 14,
    fontWeight: 600,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs
  },
  input: {
    width: "100%",
    padding: theme.spacing.md,
    fontSize: 15,
    borderRadius: theme.radii.md,
    border: `1px solid ${theme.colors.divider}`,
    background: theme.colors.background,
    color: theme.colors.text,
    fontFamily: "inherit"
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
  textarea: {
    width: "100%",
    padding: theme.spacing.md,
    fontSize: 15,
    borderRadius: theme.radii.md,
    border: `1px solid ${theme.colors.divider}`,
    background: theme.colors.background,
    color: theme.colors.text,
    fontFamily: "inherit",
    resize: "vertical" as const
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

export default CheckoutScreen;
