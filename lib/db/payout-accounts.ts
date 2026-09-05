import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

export type PayoutAccountRow =
  Database["public"]["Tables"]["payout_accounts"]["Row"];

export async function getPayoutAccount(userId: string) {
  const db = createServiceClient();
  const { data } = await db
    .from("payout_accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as PayoutAccountRow | null) ?? null;
}

export async function upsertPayoutAccount(
  userId: string,
  provider: string,
  link: string,
) {
  const db = createServiceClient();
  const { error } = await db.from("payout_accounts").upsert(
    {
      user_id: userId,
      payout_provider: provider,
      payout_link: link,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

export async function deletePayoutAccount(userId: string) {
  const db = createServiceClient();
  const { error } = await db
    .from("payout_accounts")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}
