import { createServiceClient } from "@/lib/supabase/service";
import { ensurePaymentSchedule } from "@/lib/db/placement-payments";
import { ensureEngagementSchedule } from "./schedules";

/** Acceptance is committed atomically; schedule setup is a retryable effect.
 * This also repairs crashes where the response never reached the worker. */
export async function recoverAcceptedSchedules(): Promise<string[]> {
  const db = createServiceClient();
  const errors: string[] = [];
  let afterId: string | undefined;
  for (;;) {
    let query = db
      .from("engagements")
      .select("id")
      .eq("source_kind", "org_role")
      .in("status", ["pending_funding", "active"])
      .order("id")
      .limit(100);
    if (afterId) query = query.gt("id", afterId);
    const { data, error } = await query;
    if (error) throw error;
    for (const item of data ?? []) {
      try {
        await ensureEngagementSchedule(item.id, 1);
      } catch {
        errors.push(`${item.id}: role schedule setup failed`);
      }
    }
    if (!data || data.length < 100) break;
    afterId = data[data.length - 1].id;
  }
  afterId = undefined;
  for (;;) {
    let query = db
      .from("placement_agreements")
      .select("*")
      .eq("payment_mode", "managed")
      .in("status", ["pending_funding", "active"])
      .order("id")
      .limit(100);
    if (afterId) query = query.gt("id", afterId);
    const { data, error } = await query;
    if (error) throw error;
    for (const item of data ?? []) {
      try {
        await ensurePaymentSchedule(item);
      } catch {
        errors.push(`${item.id}: placement schedule setup failed`);
      }
    }
    if (!data || data.length < 100) break;
    afterId = data[data.length - 1].id;
  }
  return errors;
}
