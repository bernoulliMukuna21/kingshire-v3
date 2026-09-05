import { createServiceClient } from "@/lib/supabase/service";

// Mirrors the `client_subscriptions` table (migration 056). It gates the CARD
// payment rail for personal Clients: an active row means the Client may fund
// jobs by card; without one they are limited to bank transfer.
export type ClientSubscriptionRow = {
  user_id: string;
  status: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

// `client_subscriptions` is added by migration 056 and is not part of the
// generated Supabase types until `npm run gen:types` is re-run. Access it
// through a narrowly-typed view of the service client in the meantime — the
// casts stay valid once the table is present in the generated types.
type MaybeResult<T> = { data: T | null; error: { message: string } | null };
type WriteResult = { error: { message: string } | null };
type Filter = {
  eq: (column: string, value: string) => Filter;
  maybeSingle: () => Promise<MaybeResult<ClientSubscriptionRow>>;
};
type ClientSubscriptionsTable = {
  select: (columns: string) => Filter;
  upsert: (
    row: Partial<ClientSubscriptionRow>,
    options: { onConflict: string },
  ) => Promise<WriteResult>;
  update: (row: Partial<ClientSubscriptionRow>) => {
    eq: (column: string, value: string) => Promise<WriteResult>;
  };
};

function subscriptionsTable(): ClientSubscriptionsTable {
  return createServiceClient().from(
    "client_subscriptions" as never,
  ) as unknown as ClientSubscriptionsTable;
}

export async function getClientSubscriptionRow(
  userId: string,
): Promise<ClientSubscriptionRow | null> {
  const { data } = await subscriptionsTable()
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function upsertClientSubscription(
  row: Partial<ClientSubscriptionRow> & { user_id: string },
): Promise<void> {
  const { error } = await subscriptionsTable().upsert(row, {
    onConflict: "user_id",
  });
  if (error) {
    throw new Error(`Unable to save client subscription: ${error.message}`);
  }
}

export async function updateClientSubscriptionBySubscriptionId(
  stripeSubscriptionId: string,
  update: Partial<ClientSubscriptionRow>,
): Promise<void> {
  const { error } = await subscriptionsTable()
    .update(update)
    .eq("stripe_subscription_id", stripeSubscriptionId);
  if (error) {
    throw new Error(`Unable to sync client subscription: ${error.message}`);
  }
}
