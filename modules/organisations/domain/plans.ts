export const ORGANISATION_PLAN_IDS = ["starter", "growth", "scale"] as const;

export type OrganisationPlanId = (typeof ORGANISATION_PLAN_IDS)[number];

export type OrganisationPlan = {
  id: OrganisationPlanId;
  name: string;
  monthlyPriceGBP: number;
  description: string;
  features: readonly string[];
  highlighted?: boolean;
};

/**
 * Product-facing plan information lives in one module so the setup UI and
 * Stripe adapter cannot silently disagree about plan IDs or displayed prices.
 * Placement entitlements remain deliberately absent until that product is
 * defined and implemented.
 */
export const ORGANISATION_PLANS: readonly OrganisationPlan[] = [
  {
    id: "starter",
    name: "Starter",
    monthlyPriceGBP: 10,
    description: "For small organisations setting up their first shared workspace.",
    features: [
      "Organisation profile and workspace",
      "Unlimited ordinary paid job posts",
      "Invite and manage your team",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    monthlyPriceGBP: 25,
    description: "For growing organisations coordinating more hiring activity.",
    features: [
      "Everything in Starter",
      "Built for growing teams",
      "Ready for future placement capacity",
    ],
    highlighted: true,
  },
  {
    id: "scale",
    name: "Scale",
    monthlyPriceGBP: 40,
    description: "For established organisations preparing to operate at scale.",
    features: [
      "Everything in Growth",
      "Built for larger operations",
      "Ready for future advanced controls",
    ],
  },
] as const;

export function isOrganisationPlanId(
  value: unknown,
): value is OrganisationPlanId {
  return (
    typeof value === "string" &&
    ORGANISATION_PLAN_IDS.includes(value as OrganisationPlanId)
  );
}

export function getOrganisationPlan(planId: OrganisationPlanId) {
  return ORGANISATION_PLANS.find((plan) => plan.id === planId)!;
}
