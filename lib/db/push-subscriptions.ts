import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

export type PushSubscriptionRow =
  Database["public"]["Tables"]["push_subscriptions"]["Row"];

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function listPushSubscriptions(userId: string) {
  const db = createServiceClient();
  const { data, error } = await db
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as PushSubscriptionRow[];
}

export async function upsertPushSubscription(
  userId: string,
  subscription: PushSubscriptionInput,
  userAgent?: string,
) {
  const db = createServiceClient();
  const { error } = await db.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: userAgent ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
}

export async function deletePushSubscription(userId: string, endpoint: string) {
  const db = createServiceClient();
  const { error } = await db
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint);
  if (error) throw error;
}

export async function deleteStalePushSubscriptions(endpoints: string[]) {
  if (endpoints.length === 0) return;
  const db = createServiceClient();
  await db.from("push_subscriptions").delete().in("endpoint", endpoints);
}
