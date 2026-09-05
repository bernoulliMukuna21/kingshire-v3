import {
  getUserSubscriptionRow,
  type UserSubscriptionRow,
} from "@/lib/db/user-subscriptions";
import {
  planForRole,
  getSubscriptionPlan,
  type SubscriptionRole,
  type SubscriptionPlan,
} from "@/lib/subscriptions/plans";

// Stripe subscription states that count as "on". `active` also covers a
// subscription set to cancel at period end — it stays active until then.
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export type UserSubscription = {
  role: SubscriptionRole;
  plan: string;
  status: string;
  isActive: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
};

function toUserSubscription(
  row: UserSubscriptionRow | null,
): UserSubscription | null {
  if (!row) return null;
  return {
    role: row.role,
    plan: row.plan,
    status: row.status,
    isActive: ACTIVE_STATUSES.has(row.status),
    cancelAtPeriodEnd: row.cancel_at_period_end,
    currentPeriodEnd: row.current_period_end,
  };
}

export async function getUserSubscription(
  userId: string,
): Promise<UserSubscription | null> {
  return toUserSubscription(await getUserSubscriptionRow(userId));
}

// Whether the user holds an active subscription for the given role. A stored
// subscription only grants entitlements for the role it was bought as, so a
// client who switched to kinglancer gets nothing from an old client sub.
export async function isSubscribed(
  userId: string,
  role: SubscriptionRole,
): Promise<boolean> {
  const subscription = await getUserSubscription(userId);
  return !!subscription && subscription.isActive && subscription.role === role;
}

// Whether an active subscription grants a specific entitlement.
export async function hasEntitlement(
  userId: string,
  role: SubscriptionRole,
  key: keyof SubscriptionPlan["entitlements"],
): Promise<boolean> {
  const subscription = await getUserSubscription(userId);
  if (!subscription || !subscription.isActive || subscription.role !== role) {
    return false;
  }
  const plan =
    getSubscriptionPlan(subscription.plan) ?? planForRole(subscription.role);
  return !!plan.entitlements[key];
}
