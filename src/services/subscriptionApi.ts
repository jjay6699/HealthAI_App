export type SubscriptionTier = "free" | "plus" | "pro";

export type SubscriptionStatus = {
  tier: SubscriptionTier;
  label: string;
  status?: string | null;
  currentPeriodStart?: number | null;
  currentPeriodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
  reportLimit: number;
  reportUsed: number;
  reportRemaining: number;
  lifetimeLimit: boolean;
};

export type SubscriptionPlan = {
  tier: SubscriptionTier;
  label: string;
  price: number;
  reportLimit: number;
  lifetimeLimit: boolean;
  isConfigured: boolean;
};

export type SubscriptionPayload = {
  subscription: SubscriptionStatus;
  plans: SubscriptionPlan[];
};

const parsePayload = async (response: Response) => {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error || `HTTP ${response.status}`);
    (error as Error & { payload?: unknown }).payload = payload;
    throw error;
  }
  return payload;
};

export const fetchSubscriptionStatus = async (): Promise<SubscriptionPayload> => {
  const response = await fetch("/api/subscription/status", {
    credentials: "same-origin"
  });
  return parsePayload(response) as Promise<SubscriptionPayload>;
};

export const createSubscriptionCheckoutSession = async (tier: Exclude<SubscriptionTier, "free">) => {
  const response = await fetch("/api/subscription/checkout-session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tier })
  });
  return parsePayload(response) as Promise<{ url: string; sessionId: string }>;
};

export const createSubscriptionPortalSession = async () => {
  const response = await fetch("/api/subscription/portal-session", {
    method: "POST",
    credentials: "same-origin"
  });
  return parsePayload(response) as Promise<{ url: string }>;
};

export const confirmSubscriptionCheckout = async (sessionId: string): Promise<SubscriptionPayload> => {
  const response = await fetch("/api/subscription/confirm-checkout", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId })
  });
  return parsePayload(response) as Promise<SubscriptionPayload>;
};

export const reserveReportAnalysis = async () => {
  const response = await fetch("/api/report-analysis/reserve", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" }
  });
  return parsePayload(response) as Promise<{ reservationId: string; subscription: SubscriptionStatus }>;
};

export const consumeReportAnalysis = async (reservationId: string) => {
  const response = await fetch("/api/report-analysis/consume", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reservationId })
  });
  return parsePayload(response) as Promise<{ subscription: SubscriptionStatus }>;
};

export const releaseReportAnalysis = async (reservationId: string) => {
  const response = await fetch("/api/report-analysis/release", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reservationId })
  });
  return parsePayload(response) as Promise<{ subscription: SubscriptionStatus }>;
};
