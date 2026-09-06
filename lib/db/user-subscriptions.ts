import { createServiceClient } from "@/lib/supabase/service";
import type { SubscriptionRole } from "@/lib/subscriptions/plans";

// Mirrors the `user_subscriptions` table (migration 056). One flat monthly
// subscription per user; `role` records whether it is a client or kinglancer
// subscription.
export type UserSubscriptionRow = {
  user_id: string;
  role: SubscriptionRole;
  plan: string;
  status: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

// `user_subscriptions` is added by migration 056 and is not part of the
// generated Supabase types until `npm run gen:types` is re-run. Access it
// through a narrowly-typed view of the service client in the meantime — the
// casts stay valid once the table is present in the generated types.
type MaybeResult<T> = { data: T | null; error: { message: string } | null };
type WriteResult = { error: { message: string } | null };
type Filter = {
  eq: (column: string, value: string) => Filter;
  maybeSingle: () => Promise<MaybeResult<UserSubscriptionRow>>;
};
type UserSubscriptionsTable = {
  select: (columns: string) => Filter;
  upsert: (
    row: Partial<UserSubscriptionRow>,
    options: { onConflict: string },
  ) => Promise<WriteResult>;
  update: (row: Partial<UserSubscriptionRow>) => {
    eq: (column: string, value: string) => Promise<WriteResult>;
  };
};

function table(): UserSubscriptionsTable {
  return createServiceClient().from(
    "user_subscriptions" as never,
  ) as unknown as UserSubscriptionsTable;
}

export async function getUserSubscriptionRow(
  userId: string,
): Promise<UserSubscriptionRow | null> {
  const { data } = await table()
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function upsertUserSubscription(
  row: Partial<UserSubscriptionRow> & { user_id: string },
): Promise<void> {
  const { error } = await table().upsert(row, { onConflict: "user_id" });
  if (error) {
    throw new Error(`Unable to save subscription: ${error.message}`);
  }
}

export async function updateUserSubscriptionBySubscriptionId(
  stripeSubscriptionId: string,
  update: Partial<UserSubscriptionRow>,
): Promise<void> {
  const { error } = await table()
    .update(update)
    .eq("stripe_subscription_id", stripeSubscriptionId);
  if (error) {
    throw new Error(`Unable to sync subscription: ${error.message}`);
  }
}
