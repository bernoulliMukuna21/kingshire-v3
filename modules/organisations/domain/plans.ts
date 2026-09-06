export const ORGANISATION_PLAN_IDS = ["starter", "growth", "scale"] as const;

export type OrganisationPlanId = (typeof ORGANISATION_PLAN_IDS)[number];

export type OrganisationPlan = {
  id: OrganisationPlanId;
  name: string;
  monthlyPriceGBP: number;
  description: string;
  features: readonly string[];
  entitlements: {
    teammates: number;
    volunteerSchemes: number;
    paidPlacements: number;
    activeParticipants: number;
    reporting: "Basic" | "Team" | "Advanced";
  };
  highlighted?: boolean;
};

/**
 * Product-facing plan information lives in one module so the setup UI and
 * Stripe adapter cannot silently disagree about plan IDs or displayed prices.
 * Placement allowances are product entitlements. They are displayed during
 * setup now and become enforceable when placements launch.
 */
export const ORGANISATION_PLANS: readonly OrganisationPlan[] = [
  {
    id: "starter",
    name: "Starter",
    monthlyPriceGBP: 15,
    description:
      "For small organisations setting up their first shared workspace.",
    features: [
      "Organisation profile and workspace",
      "Unlimited ordinary paid job posts",
      "Placement Passport included",
    ],
    entitlements: {
      teammates: 3,
      volunteerSchemes: 1,
      paidPlacements: 2,
      activeParticipants: 3,
      reporting: "Basic",
    },
  },
  {
    id: "growth",
    name: "Growth",
    monthlyPriceGBP: 25,
    description: "For growing organisations coordinating more hiring activity.",
    features: [
      "Organisation profile and workspace",
      "Unlimited ordinary paid job posts",
      "Placement Passport included",
    ],
    entitlements: {
      teammates: 10,
      volunteerSchemes: 3,
      paidPlacements: 6,
      activeParticipants: 10,
      reporting: "Team",
    },
    highlighted: true,
  },
  {
    id: "scale",
    name: "Scale",
    monthlyPriceGBP: 40,
    description: "For established organisations preparing to operate at scale.",
    features: [
      "Organisation profile and workspace",
      "Unlimited ordinary paid job posts",
      "Placement Passport included",
    ],
    entitlements: {
      teammates: 25,
      volunteerSchemes: 10,
      paidPlacements: 20,
      activeParticipants: 30,
      reporting: "Advanced",
    },
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
