import {
  getClientSubscriptionRow,
  type ClientSubscriptionRow,
} from "@/lib/db/client-subscriptions";

// The monthly price a personal Client pays to unlock the card payment rail.
export const CLIENT_SUBSCRIPTION_PRICE_GBP = 10;

// Stripe subscription states that grant card access. `active` also covers a
// subscription set to cancel at period end — it stays active until then.
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export type ClientSubscription = {
  status: string;
  isActive: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
};

function toClientSubscription(
  row: ClientSubscriptionRow | null,
): ClientSubscription | null {
  if (!row) return null;
  return {
    status: row.status,
    isActive: ACTIVE_STATUSES.has(row.status),
    cancelAtPeriodEnd: row.cancel_at_period_end,
    currentPeriodEnd: row.current_period_end,
  };
}

export async function getClientSubscription(
  userId: string,
): Promise<ClientSubscription | null> {
  return toClientSubscription(await getClientSubscriptionRow(userId));
}

// Whether a personal Client may pay by card. Org jobs are covered by the
// Organisation subscription and are checked separately.
export async function hasActiveClientSubscription(
  userId: string,
): Promise<boolean> {
  const subscription = await getClientSubscription(userId);
  return subscription?.isActive ?? false;
}

// Card access for a specific job. Organisation-posted jobs always qualify (the
// Organisation carries its own subscription); personal jobs require the payer
// to hold an active client subscription.
export async function jobCardPaymentAllowed(job: {
  organisation_id: string | null;
  client_id: string;
}): Promise<boolean> {
  if (job.organisation_id) return true;
  return hasActiveClientSubscription(job.client_id);
}
