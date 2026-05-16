import React, { useState } from "react";
import { useTheme } from "../theme";
import {
  SubscriptionPayload,
  SubscriptionTier,
  createSubscriptionCheckoutSession,
  createSubscriptionPortalSession
} from "../services/subscriptionApi";

type Props = {
  payload: SubscriptionPayload | null;
  onClose: () => void;
};

const PLAN_FEATURES: Record<SubscriptionTier, string[]> = {
  free: ["Full AI Health Chat", "1 lifetime report analysis", "General guidance", "Device sync locked"],
  plus: ["Full AI Health Chat", "3 report analyses/month", "Personalized suggestions", "Device sync included, coming soon"],
  pro: ["Top-tier AI Health Chat", "15 report analyses/month", "Deep biomarker mapping", "Device sync included, coming soon"]
};

const SubscriptionUpgradeModal: React.FC<Props> = ({ payload, onClose }) => {
  const theme = useTheme();
  const [loadingTier, setLoadingTier] = useState<SubscriptionTier | "portal" | null>(null);
  const subscription = payload?.subscription;
  const plans = payload?.plans || [];

  const startCheckout = async (tier: Exclude<SubscriptionTier, "free">) => {
    setLoadingTier(tier);
    try {
      const session = await createSubscriptionCheckoutSession(tier);
      window.location.assign(session.url);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to start subscription checkout.");
      setLoadingTier(null);
    }
  };

  const openPortal = async () => {
    setLoadingTier("portal");
    try {
      const session = await createSubscriptionPortalSession();
      window.location.assign(session.url);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to open subscription management.");
      setLoadingTier(null);
    }
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={{ ...styles.modal, background: theme.colors.background }} onClick={(event) => event.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <h2 style={{ ...styles.title, color: theme.colors.text }}>Choose your plan</h2>
            <p style={{ ...styles.subtitle, color: theme.colors.textSecondary }}>
              {subscription
                ? `${subscription.label}: ${subscription.reportRemaining}/${subscription.reportLimit} report analyses remaining`
                : "Pick a plan to continue report analysis."}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ ...styles.closeButton, color: theme.colors.text }}>×</button>
        </div>

        <div style={styles.planGrid}>
          {plans.map((plan) => {
            const isCurrent = subscription?.tier === plan.tier;
            const isPaid = plan.tier !== "free";
            const hasPaidSubscription = subscription?.tier === "plus" || subscription?.tier === "pro";

            return (
              <div
                key={plan.tier}
                style={{
                  ...styles.planCard,
                  borderColor: isCurrent ? theme.colors.primary : theme.colors.divider,
                  background: isCurrent ? theme.colors.accentPeach : theme.colors.surface
                }}
              >
                <div style={styles.planTop}>
                  <span style={{ ...styles.planName, color: theme.colors.text }}>{plan.label}</span>
                  {isCurrent ? <span style={{ ...styles.badge, background: theme.colors.primary }}>Current</span> : null}
                </div>
                <p style={{ ...styles.price, color: theme.colors.text }}>
                  {plan.price === 0 ? "Free" : `RM${plan.price.toFixed(2)}/mo`}
                </p>
                <ul style={styles.featureList}>
                  {PLAN_FEATURES[plan.tier].map((feature) => (
                    <li key={feature} style={{ ...styles.featureItem, color: theme.colors.textSecondary }}>{feature}</li>
                  ))}
                </ul>
                {isPaid ? (
                  <button
                    type="button"
                    disabled={!plan.isConfigured || loadingTier !== null}
                    onClick={() => {
                      if (hasPaidSubscription) {
                        void openPortal();
                        return;
                      }
                      void startCheckout(plan.tier as Exclude<SubscriptionTier, "free">);
                    }}
                    style={{
                      ...styles.primaryButton,
                      background: theme.colors.primary,
                      opacity: !plan.isConfigured || loadingTier !== null ? 0.6 : 1
                    }}
                  >
                    {loadingTier === plan.tier || loadingTier === "portal"
                      ? "Redirecting..."
                      : plan.isConfigured
                      ? hasPaidSubscription ? "Manage plan" : `Upgrade to ${plan.label}`
                      : "Coming soon"}
                  </button>
                ) : (
                  <button type="button" disabled style={{ ...styles.secondaryButton, borderColor: theme.colors.divider, color: theme.colors.textSecondary }}>
                    1 trial report
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {subscription?.tier !== "free" ? (
          <button
            type="button"
            onClick={openPortal}
            disabled={loadingTier !== null}
            style={{ ...styles.manageButton, color: theme.colors.primary }}
          >
            {loadingTier === "portal" ? "Opening billing portal..." : "Manage subscription"}
          </button>
        ) : null}
      </div>
    </div>
  );
};

const styles = {
  backdrop: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(17, 24, 39, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 260,
    padding: 16
  },
  modal: {
    width: "min(940px, 100%)",
    maxHeight: "92vh",
    overflow: "auto",
    borderRadius: 28,
    padding: 24,
    boxShadow: "0 32px 90px rgba(15, 23, 42, 0.24)"
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 20
  },
  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 800
  },
  subtitle: {
    margin: "6px 0 0",
    fontSize: 15,
    lineHeight: "22px"
  },
  closeButton: {
    border: "none",
    background: "transparent",
    fontSize: 30,
    lineHeight: 1,
    cursor: "pointer"
  },
  planGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14
  },
  planCard: {
    border: "1px solid",
    borderRadius: 22,
    padding: 18,
    display: "flex",
    flexDirection: "column" as const,
    gap: 14
  },
  planTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  },
  planName: {
    fontSize: 20,
    fontWeight: 800
  },
  badge: {
    borderRadius: 999,
    color: "#fff",
    fontSize: 11,
    fontWeight: 800,
    padding: "5px 8px"
  },
  price: {
    margin: 0,
    fontSize: 24,
    fontWeight: 900
  },
  featureList: {
    margin: 0,
    paddingLeft: 18,
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    flex: 1
  },
  featureItem: {
    fontSize: 14,
    lineHeight: "20px"
  },
  primaryButton: {
    border: "none",
    borderRadius: 16,
    color: "#fff",
    cursor: "pointer",
    fontWeight: 800,
    padding: "13px 14px"
  },
  secondaryButton: {
    border: "1px solid",
    borderRadius: 16,
    background: "transparent",
    fontWeight: 800,
    padding: "13px 14px"
  },
  manageButton: {
    marginTop: 18,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontWeight: 800,
    padding: 8
  }
};

export default SubscriptionUpgradeModal;
