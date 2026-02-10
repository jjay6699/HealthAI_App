import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/Card";
import Button from "../../components/Button";
import SectionHeader from "../../components/SectionHeader";
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
  const navigate = useNavigate();
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  
  // Form state
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

    // Load saved address if exists
    const savedAddress = persistentStorage.getItem("deliveryAddress");
    if (savedAddress) {
      try {
        setFormData(prev => ({ ...prev, ...JSON.parse(savedAddress) }));
      } catch (error) {
        console.error("Failed to parse saved address:", error);
      }
    }
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleContinue = () => {
    // Validate form
    if (!formData.fullName || !formData.phone || !formData.addressLine1 ||
        !formData.city || !formData.postcode || !formData.state) {
      alert("Please fill in all required fields");
      return;
    }

    // Save delivery address
    persistentStorage.setItem("deliveryAddress", JSON.stringify(formData));

    // Add to shipping addresses if not already exists
    const shippingAddresses = JSON.parse(persistentStorage.getItem("shippingAddresses") || "[]");
    const addressExists = shippingAddresses.some((addr: any) =>
      addr.addressLine1 === formData.addressLine1 &&
      addr.postcode === formData.postcode
    );

    if (!addressExists) {
      const newAddress = {
        id: `addr_${Date.now()}`,
        ...formData,
        isDefault: shippingAddresses.length === 0 // First address is default
      };
      shippingAddresses.push(newAddress);
      persistentStorage.setItem("shippingAddresses", JSON.stringify(shippingAddresses));
    }

    // Navigate to payment
    navigate("/payment");
  };

  if (!orderDetails) {
    return (
      <div style={styles.page}>
        <h1 style={styles.heading}>No order found</h1>
        <p style={styles.subheading}>Please review your order first.</p>
        <Button title="Back to Order Review" onClick={() => navigate("/order-review")} />
      </div>
    );
  }

  const malaysianStates = [
    "Johor", "Kedah", "Kelantan", "Kuala Lumpur", "Labuan", "Malacca", "Negeri Sembilan",
    "Pahang", "Penang", "Perak", "Perlis", "Putrajaya", "Sabah", "Sarawak", "Selangor", "Terengganu"
  ];

  return (
    <div style={styles.page}>
      {/* Back Button */}
      <button onClick={() => navigate("/order-review")} style={styles.backButton}>
        <span style={styles.backArrow}>←</span>
        <span>Back to Cart</span>
      </button>

      <h1 style={styles.heading}>Delivery Details</h1>
      <p style={styles.subheading}>Where should we send your custom blend?</p>

      {/* Delivery Address Form */}
      <Card style={styles.card}>
        <SectionHeader title="Delivery Address" />
        
        <div style={styles.formGroup}>
          <label style={styles.label}>Full Name *</label>
          <input
            type="text"
            value={formData.fullName}
            onChange={(e) => handleInputChange("fullName", e.target.value)}
            placeholder="John Doe"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Phone Number *</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handleInputChange("phone", e.target.value)}
            placeholder="+60 12-345 6789"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Address Line 1 *</label>
          <input
            type="text"
            value={formData.addressLine1}
            onChange={(e) => handleInputChange("addressLine1", e.target.value)}
            placeholder="Street address, P.O. box"
            style={styles.input}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Address Line 2</label>
          <input
            type="text"
            value={formData.addressLine2}
            onChange={(e) => handleInputChange("addressLine2", e.target.value)}
            placeholder="Apartment, suite, unit, building, floor, etc."
            style={styles.input}
          />
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>City *</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => handleInputChange("city", e.target.value)}
              placeholder="Kuala Lumpur"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Postcode *</label>
            <input
              type="text"
              value={formData.postcode}
              onChange={(e) => handleInputChange("postcode", e.target.value)}
              placeholder="50000"
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>State *</label>
          <select
            value={formData.state}
            onChange={(e) => handleInputChange("state", e.target.value)}
            style={styles.select}
          >
            <option value="">Select state</option>
            {malaysianStates.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Special Instructions (Optional)</label>
          <textarea
            value={formData.specialInstructions}
            onChange={(e) => handleInputChange("specialInstructions", e.target.value)}
            placeholder="Any special delivery instructions..."
            style={styles.textarea}
            rows={3}
          />
        </div>
      </Card>

      {/* Order Summary */}
      <Card style={styles.card}>
        <SectionHeader title="Order Summary" />
        <div style={styles.summaryRow}>
          <span style={styles.summaryLabel}>
            {orderDetails.recommendations.length} nutrition items ({orderDetails.planLabel || orderDetails.plan})
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

      {/* Continue Button */}
      <div style={styles.footerSpacer} />
      <div style={styles.footer}>
        <div style={styles.footerContent}>
          <Button
            title="Continue to Payment"
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


