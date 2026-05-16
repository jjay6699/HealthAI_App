export const DELIVERY_COUNTRIES = ["Malaysia", "Singapore"] as const;

export type DeliveryCountry = (typeof DELIVERY_COUNTRIES)[number];

export const getBottleCountForPlan = (plan?: string) => {
  switch (plan) {
    case "one-bottle":
      return 1;
    case "three-months":
      return 6;
    case "one-month":
    default:
      return 2;
  }
};

export const calculateDeliveryFee = (country: string | undefined, plan: string | undefined) => {
  if (country !== "Singapore") return 0;
  return getBottleCountForPlan(plan) <= 1 ? 25 : 50;
};
