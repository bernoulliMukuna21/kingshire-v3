import { createServiceClient } from "@/lib/supabase/service";

/** Caller must authorise manage_applicants before offering. The database locks
 * the job and atomically creates/reopens its engagement and offers the application.
 * Pass `terms` to (re)set the role's pay atomically with the offer — allowed
 * any time it's safe to (no pending/active engagement, no payment history),
 * not just the first time, so a declined candidate doesn't leave the posting
 * permanently stuck on its first-offered terms. */
export async function offerRoleApplication(
  applicationId: string,
  signerId: string,
  terms?: {
    payAmount: number;
    payCadence: "weekly" | "monthly";
    settlementMode: "managed" | "direct";
  },
) {
  const { data, error } = await createServiceClient().rpc(
    "offer_role_application",
    {
      p_application_id: applicationId,
      p_signer_id: signerId,
      p_pay_amount: terms?.payAmount ?? null,
      p_pay_cadence: terms?.payCadence ?? null,
      p_settlement_mode: terms?.settlementMode ?? null,
    },
  );
  if (error) throw error;
  return data;
}

/** Withdraw an offer before any money has moved. A payment currently in
 * flight blocks this; one that already succeeded freezes the engagement for
 * admin reconciliation instead of silently cancelling a paid role. */
export async function withdrawPendingRoleEngagement(
  engagementId: string,
  actorId: string,
  reason?: string,
) {
  const { data, error } = await createServiceClient().rpc(
    "withdraw_pending_engagement",
    {
      p_engagement_id: engagementId,
      p_actor_id: actorId,
      p_reason: reason ?? null,
    },
  );
  if (error) throw error;
  return data;
}
