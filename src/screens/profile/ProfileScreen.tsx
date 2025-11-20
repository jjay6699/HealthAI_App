import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../components/Card";
import SectionHeader from "../../components/SectionHeader";
import Button from "../../components/Button";
import Dialog from "../../components/Dialog";
import { AppTheme, useTheme } from "../../theme";

type ProfileState = {
  avatarImage: string | null;
  name: string;
  email: string;
  dob: string;
  height: number;
  weight: number;
  activityLevel: string;
  dataProcessing: string;
  dataStorage: string;
  research: string;
  appleHealth: string;
  googleFit: string;
};

type PaymentMethod = {
  id: string;
  type: "card" | "fpx" | "ewallet";
  last4?: string;
  brand?: string;
  isDefault: boolean;
};

type ShippingAddress = {
  id: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postcode: string;
  isDefault: boolean;
};

type Order = {
  orderNumber: string;
  date: string;
  plan: string;
  price: number;
  status: "processing" | "shipped" | "delivered" | "cancelled";
};

type EditKey = keyof ProfileState;

// Helper function to generate initials from name
const getInitials = (name: string): string => {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return words.map(w => w[0]).join("").substring(0, 2).toUpperCase();
};

const ProfileScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileState>(() => {
    const saved = localStorage.getItem("userProfile");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migration for old `measurements` string
        if (typeof parsed.measurements === 'string') {
          const [heightStr, weightStr] = parsed.measurements.split('•').map(s => s.trim());
          parsed.height = parseInt(heightStr, 10) || 175;
          parsed.weight = parseInt(weightStr, 10) || 70;
          delete parsed.measurements; // Remove old key
        }
        return parsed;
      } catch {
        // Fall through to default
      }
    }
    return {
      avatarImage: null,
      name: "JJAY TECH",
      email: "contact@jjay.info",
      dob: "1986-07-28",
      height: 175, // Default height in cm
      weight: 70, // Default weight in kg
      activityLevel: "Moderate",
      dataProcessing: "Allowed",
      dataStorage: "Opted in",
      research: "Opted out",
      appleHealth: "Not connected",
      googleFit: "Not connected"
    };
  });

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(() => {
    const saved = localStorage.getItem("paymentMethods");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [shippingAddresses, setShippingAddresses] = useState<ShippingAddress[]>(() => {
    const saved = localStorage.getItem("shippingAddresses");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem("orderHistory");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [editState, setEditState] = useState<null | {
    key: EditKey;
    label: string;
    helper?: string;
    value: string;
  }>(null);
  const [editValue, setEditValue] = useState("");
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [isEditingMeasurements, setIsEditingMeasurements] = useState(false);

  // Temporary state for measurement editor
  const [tempHeight, setTempHeight] = useState(profile.height);
  const [tempWeight, setTempWeight] = useState(profile.weight);

  // Auto-generate initials from name
  const avatarInitials = useMemo(() => getInitials(profile.name), [profile.name]);

  // Save profile to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("userProfile", JSON.stringify(profile));
  }, [profile]);

  // Save payment methods to localStorage
  useEffect(() => {
    localStorage.setItem("paymentMethods", JSON.stringify(paymentMethods));
  }, [paymentMethods]);

  // Save shipping addresses to localStorage
  useEffect(() => {
    localStorage.setItem("shippingAddresses", JSON.stringify(shippingAddresses));
  }, [shippingAddresses]);

  // Save order history to localStorage
  useEffect(() => {
    localStorage.setItem("orderHistory", JSON.stringify(orders));
  }, [orders]);

  const openEdit = (key: EditKey, label: string, helper?: string) => {
    setEditState({ key, label, helper, value: profile[key] as string });
    setEditValue(profile[key] as string);
  };

  const handleConfirm = () => {
    if (!editState) return;
    let value = editValue.trim();
    if (!value) {
      setEditState(null);
      return;
    }
    setProfile((prev) => ({ ...prev, [editState.key]: value }));
    setEditState(null);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile(prev => ({ ...prev, avatarImage: reader.result as string }));
        setShowImageUpload(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setProfile(prev => ({ ...prev, avatarImage: null }));
    setShowImageUpload(false);
  };

  // When measurement editor opens, sync temp state
  useEffect(() => {
    if (isEditingMeasurements) {
      setTempHeight(profile.height);
      setTempWeight(profile.weight);
    }
  }, [isEditingMeasurements, profile.height, profile.weight]);

  const handleConfirmMeasurements = () => {
    setProfile((prev) => ({ ...prev, height: tempHeight, weight: tempWeight }));
    setIsEditingMeasurements(false);
  };

  return (
    <div style={styles.page}>
      <header style={styles.hero}>
        <div className="profile-avatar-container" style={styles.avatarContainer}>
          <div className="profile-avatar-shell" style={styles.avatarShell} onClick={() => setShowImageUpload(true)}>
            {profile.avatarImage ? (
              <>
                <img src={profile.avatarImage} alt="Profile" style={styles.avatarImage} />
                <div className="profile-avatar-overlay" style={styles.avatarOverlay}>
                  <span style={styles.avatarOverlayText}>Change</span>
                </div>
              </>
            ) : (
              <>
                <span style={styles.avatarInitials}>{avatarInitials}</span>
                <div className="profile-avatar-overlay" style={styles.avatarOverlay}>
                  <span style={styles.avatarOverlayText}>Upload</span>
                </div>
              </>
            )}
          </div>
        </div>
        <div style={styles.heroInfo}>
          <h1 style={styles.name}>{profile.name}</h1>
          <p style={styles.email}>{profile.email}</p>
          <button type="button" style={styles.editProfileButton} onClick={() => openEdit("name", "Full name")}>
            Edit profile
          </button>
        </div>
      </header>

      <Card style={styles.card}>
        <SectionHeader title="Personal info" />
        <ProfileRow label="Full name" value={profile.name} action="Edit" onEdit={() => openEdit("name", "Full name")} />
        <ProfileRow label="Email" value={profile.email} action="Edit" onEdit={() => openEdit("email", "Email address")} />
        <ProfileRow label="Date of birth" value={profile.dob} action="Edit" onEdit={() => openEdit("dob", "Date of birth")} />
      </Card>

      <Card style={styles.card}>
        <SectionHeader title="Health data" />
        <ProfileRow label="Measurements" value={`${profile.height} cm • ${profile.weight} kg`} action="Update" onEdit={() => setIsEditingMeasurements(true)} />
        <ProfileRow label="Activity level" value={profile.activityLevel} action="Update" onEdit={() => openEdit("activityLevel", "Activity level")} />
      </Card>

      {/* Order History */}
      <Card style={styles.card}>
        <div style={styles.sectionHeaderRow}>
          <SectionHeader title="Order History" />
          {orders.length > 0 && (
            <button style={styles.viewAllButton} onClick={() => navigate("/orders")}>
              View All
            </button>
          )}
        </div>
        {orders.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>No orders yet</p>
            <Button title="Start Shopping" onClick={() => navigate("/upload")} variant="secondary" />
          </div>
        ) : (
          orders.slice(0, 3).map((order) => (
            <div key={order.orderNumber} style={styles.orderItem}>
              <div>
                <p style={styles.orderNumber}>#{order.orderNumber}</p>
                <p style={styles.orderDate}>{new Date(order.date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
              <div style={styles.orderRight}>
                <p style={styles.orderPrice}>RM{order.price}</p>
                <span style={{...styles.orderStatus, ...getStatusStyle(order.status, theme)}}>{order.status}</span>
              </div>
            </div>
          ))
        )}
      </Card>

      {/* Payment Methods */}
      <Card style={styles.card}>
        <div style={styles.sectionHeaderRow}>
          <SectionHeader title="Payment Methods" />
          <button style={styles.addButton} onClick={() => navigate("/add-payment")}>
            + Add
          </button>
        </div>
        {paymentMethods.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>No payment methods added</p>
          </div>
        ) : (
          paymentMethods.map((method) => (
            <div key={method.id} style={styles.paymentItem}>
              <div style={styles.paymentLeft}>
                <span style={styles.paymentIcon}>{method.type === "card" ? "💳" : method.type === "fpx" ? "🏦" : "📱"}</span>
                <div>
                  <p style={styles.paymentBrand}>{method.brand || method.type.toUpperCase()}</p>
                  {method.last4 && <p style={styles.paymentLast4}>•••• {method.last4}</p>}
                </div>
              </div>
              {method.isDefault && <span style={styles.defaultBadge}>Default</span>}
            </div>
          ))
        )}
      </Card>

      {/* Shipping Addresses */}
      <Card style={styles.card}>
        <div style={styles.sectionHeaderRow}>
          <SectionHeader title="Shipping Addresses" />
          <button style={styles.addButton} onClick={() => navigate("/add-address")}>
            + Add
          </button>
        </div>
        {shippingAddresses.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>No shipping addresses added</p>
          </div>
        ) : (
          shippingAddresses.map((address) => (
            <div key={address.id} style={styles.addressItem}>
              <div>
                <p style={styles.addressName}>{address.fullName}</p>
                <p style={styles.addressText}>
                  {address.addressLine1}
                  {address.addressLine2 && `, ${address.addressLine2}`}
                </p>
                <p style={styles.addressText}>
                  {address.city}, {address.state} {address.postcode}
                </p>
                <p style={styles.addressPhone}>{address.phone}</p>
              </div>
              {address.isDefault && <span style={styles.defaultBadge}>Default</span>}
            </div>
          ))
        )}
      </Card>

      <Card style={styles.card}>
        <SectionHeader title="Privacy & connections" />
        <ProfileRow label="Data processing" value={profile.dataProcessing} action="Manage" onEdit={() => openEdit("dataProcessing", "Data processing") } />
        <ProfileRow label="Health data storage" value={profile.dataStorage} action="Manage" onEdit={() => openEdit("dataStorage", "Health data storage") } />
        <ProfileRow label="Research participation" value={profile.research} action="Manage" onEdit={() => openEdit("research", "Research participation") } />
      </Card>

      <Card style={styles.card}>
        <SectionHeader title="Linked services" />
        <ProfileRow label="Apple Health" value={profile.appleHealth} action="Connect" onEdit={() => openEdit("appleHealth", "Apple Health status") } />
        <ProfileRow label="Google Fit" value={profile.googleFit} action="Connect" onEdit={() => openEdit("googleFit", "Google Fit status") } />
      </Card>

      <div style={styles.logoutStack}>
        <Button title="Log out" variant="secondary" fullWidth />
        <button type="button" style={styles.dangerButton}>Delete my account</button>
      </div>

      {editState ? (
        <Dialog
          title={`Edit ${editState.label.toLowerCase()}`}
          description={editState.helper}
          onClose={() => setEditState(null)}
          onConfirm={handleConfirm}
        >
          <input
            type={editState.key === "dob" ? "date" : "text"}
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
            autoFocus
            style={{
              width: "100%",
              borderRadius: theme.radii.lg,
              border: `1px solid ${theme.colors.divider}`,
              padding: `${theme.spacing.lg}px`,
              fontSize: 16,
              marginTop: theme.spacing.sm
            }}
          />
        </Dialog>
      ) : null}

      {showImageUpload ? (
        <Dialog
          title="Profile Picture"
          description="Upload a custom profile picture or use your initials"
          onClose={() => setShowImageUpload(false)}
          onConfirm={() => setShowImageUpload(false)}
        >
          <div style={styles.imageUploadContainer}>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={styles.fileInput}
              id="avatar-upload"
            />
            <label htmlFor="avatar-upload" style={styles.uploadButton}>
              📷 Choose Image
            </label>
            {profile.avatarImage && (
              <button onClick={handleRemoveImage} style={styles.removeButton}>
                Remove Image
              </button>
            )}
          </div>
        </Dialog>
      ) : null}

      {isEditingMeasurements ? (
        <Dialog
          title="Edit Measurements"
          description="Update your height and weight."
          onClose={() => setIsEditingMeasurements(false)}
          onConfirm={handleConfirmMeasurements}
        >
          <div style={styles.measurementEditor}>
            <div style={styles.measurementInput}>
              <label htmlFor="height-select" style={styles.measurementLabel}>Height</label>
              <select
                id="height-select"
                value={tempHeight}
                onChange={(e) => setTempHeight(Number(e.target.value))}
                style={styles.measurementSelect}
              >
                {Array.from({ length: 101 }, (_, i) => 120 + i).map(h => (
                  <option key={h} value={h}>{h} cm</option>
                ))}
              </select>
            </div>
            <div style={styles.measurementInput}>
              <label htmlFor="weight-select" style={styles.measurementLabel}>Weight</label>
              <select
                id="weight-select"
                value={tempWeight}
                onChange={(e) => setTempWeight(Number(e.target.value))}
                style={styles.measurementSelect}
              >
                {Array.from({ length: 171 }, (_, i) => 30 + i).map(w => (
                  <option key={w} value={w}>{w} kg</option>
                ))}
              </select>
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
};

// Helper function for order status styling
const getStatusStyle = (status: Order["status"], theme: AppTheme) => {
  switch (status) {
    case "processing":
      return { background: "#FEF3C7", color: "#92400E" };
    case "shipped":
      return { background: "#DBEAFE", color: "#1E40AF" };
    case "delivered":
      return { background: "#D1FAE5", color: "#065F46" };
    case "cancelled":
      return { background: "#FEE2E2", color: "#991B1B" };
    default:
      return { background: theme.colors.surfaceMuted, color: theme.colors.textSecondary };
  }
};

const ProfileRow = ({ label, value, action, onEdit }: { label: string; value: string; action: string; onEdit: () => void }) => {
  const theme = useTheme();

  return (
    <button type="button" style={rowStyles(theme)} onClick={onEdit}>
      <div style={{ textAlign: "left" }}>
        <span style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700, color: theme.colors.textSecondary }}>
          {label}
        </span>
        <p style={{ fontSize: 15, color: theme.colors.text, margin: `${theme.spacing.xs}px 0 0` }}>{value}</p>
      </div>
      <span style={{ fontWeight: 600, color: theme.colors.primary }}>{action}</span>
    </button>
  );
};

const rowStyles = (theme: AppTheme) => ({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  width: "100%",
  padding: `${theme.spacing.lg}px ${theme.spacing.lg}px`,
  borderRadius: theme.radii.lg,
  border: `1px solid ${theme.colors.divider}`,
  background: theme.colors.surface,
  cursor: "pointer",
  gap: theme.spacing.md
});

const createStyles = (theme: AppTheme) => ({
  page: {
    width: "100%",
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    paddingTop: theme.spacing.xl
  },
  hero: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.md
  },
  avatarContainer: {
    position: "relative" as const
  },
  avatarShell: {
    width: 72,
    height: 72,
    borderRadius: 36,
    background: "linear-gradient(135deg, #FF385C 0%, #FF8A5C 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.colors.background,
    fontSize: 28,
    fontWeight: 700,
    cursor: "pointer",
    position: "relative" as const,
    overflow: "hidden",
    transition: "transform 0.2s ease"
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const
  },
  avatarOverlay: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    background: "rgba(0, 0, 0, 0.6)",
    backdropFilter: "blur(4px)",
    padding: `${theme.spacing.xs}px 0`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0,
    transition: "opacity 0.2s ease"
  },
  avatarOverlayText: {
    fontSize: 10,
    fontWeight: 600,
    color: theme.colors.background,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5
  },
  avatarInitials: {
    letterSpacing: 1
  },
  heroInfo: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.xs
  },
  name: {
    fontSize: 24,
    fontWeight: 700,
    margin: 0
  },
  email: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    margin: 0
  },
  editProfileButton: {
    alignSelf: "flex-start" as const,
    border: "none",
    background: "transparent",
    color: theme.colors.primary,
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer"
  },
  card: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.sm,
    width: "100%"
  },
  logoutStack: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.md,
    width: "100%"
  },
  dangerButton: {
    borderRadius: theme.radii.lg,
    border: `1px solid ${theme.colors.error}`,
    color: theme.colors.error,
    padding: `${theme.spacing.lg}px`,
    fontWeight: 700,
    background: "transparent",
    cursor: "pointer"
  },
  sectionHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.sm
  },
  viewAllButton: {
    background: "transparent",
    border: "none",
    color: theme.colors.primary,
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit"
  },
  addButton: {
    background: "transparent",
    border: "none",
    color: theme.colors.primary,
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit"
  },
  emptyState: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: theme.spacing.md,
    padding: `${theme.spacing.xl}px 0`
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    margin: 0
  },
  orderItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing.md,
    background: theme.colors.surface,
    borderRadius: theme.radii.lg,
    border: `1px solid ${theme.colors.divider}`
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: 600,
    color: theme.colors.text,
    margin: 0,
    marginBottom: theme.spacing.xs
  },
  orderDate: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    margin: 0
  },
  orderRight: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-end",
    gap: theme.spacing.xs
  },
  orderPrice: {
    fontSize: 16,
    fontWeight: 700,
    color: theme.colors.text,
    margin: 0
  },
  orderStatus: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
    borderRadius: theme.radii.sm,
    letterSpacing: 0.5
  },
  paymentItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: theme.spacing.md,
    background: theme.colors.surface,
    borderRadius: theme.radii.lg,
    border: `1px solid ${theme.colors.divider}`
  },
  paymentLeft: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.md
  },
  paymentIcon: {
    fontSize: 24
  },
  paymentBrand: {
    fontSize: 15,
    fontWeight: 600,
    color: theme.colors.text,
    margin: 0,
    marginBottom: theme.spacing.xs
  },
  paymentLast4: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    margin: 0
  },
  defaultBadge: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
    borderRadius: theme.radii.sm,
    background: theme.colors.primary,
    color: theme.colors.background,
    letterSpacing: 0.5
  },
  addressItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: theme.spacing.md,
    background: theme.colors.surface,
    borderRadius: theme.radii.lg,
    border: `1px solid ${theme.colors.divider}`,
    gap: theme.spacing.md
  },
  addressName: {
    fontSize: 15,
    fontWeight: 600,
    color: theme.colors.text,
    margin: 0,
    marginBottom: theme.spacing.xs
  },
  addressText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    margin: 0,
    marginBottom: theme.spacing.xs
  },
  addressPhone: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    margin: 0
  },
  imageUploadContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.md
  },
  fileInput: {
    display: "none"
  },
  uploadButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    padding: `${theme.spacing.lg}px`,
    background: theme.colors.primary,
    color: theme.colors.background,
    borderRadius: theme.radii.lg,
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    fontSize: 15,
    fontFamily: "inherit"
  },
  removeButton: {
    padding: `${theme.spacing.md}px`,
    background: "transparent",
    color: theme.colors.error,
    borderRadius: theme.radii.lg,
    border: `1px solid ${theme.colors.error}`,
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
    fontFamily: "inherit"
  },
  measurementEditor: {
    display: "flex",
    gap: theme.spacing.lg,
    marginTop: theme.spacing.md
  },
  measurementInput: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.sm
  },
  measurementLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: theme.colors.textSecondary
  },
  measurementSelect: {
    width: "100%",
    borderRadius: theme.radii.lg,
    border: `1px solid ${theme.colors.divider}`,
    padding: `${theme.spacing.lg}px`,
    fontSize: 16,
    background: theme.colors.surface,
    fontFamily: "inherit",
    color: theme.colors.text
  }
});

export default ProfileScreen;
