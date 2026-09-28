import type { UserSubscription } from "./index";
import type { SubscriptionRole } from "./plans";

export function deriveSubscriptionView(
  subscription: UserSubscription | null,
  role: SubscriptionRole,
) {
  return {
    isActive: !!subscription?.isActive && subscription.role === role,
    otherActiveRole:
      subscription?.isActive && subscription.role !== role
        ? subscription.role
        : null,
  };
}
