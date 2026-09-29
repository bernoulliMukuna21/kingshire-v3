import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hasValidAdminSession } from "@/lib/admin-auth";
import { retrySettlement } from "@/lib/settlement/dispatch";
import { reconcileSettlementOutcome } from "@/lib/settlement/reconciliation";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("resume"),
    id: z.uuid(),
    reason: z.string().trim().min(10).max(1000),
  }),
  z.object({
    action: z.enum(["reset", "retry", "reconcile"]),
    id: z.uuid(),
    ledger: z.enum(["transactions", "engagement_payments"]),
    attemptId: z.uuid(),
    reason: z.string().trim().min(10).max(1000),
    externalId: z
      .string()
      .regex(/^(tr|re)_[A-Za-z0-9]+$/)
      .optional(),
  }),
]);
export async function POST(request: Request) {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { data: profile } = await auth
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" || !(await hasValidAdminSession(user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      {
        error: "Provide a valid action and a reason of at least 10 characters.",
      },
      { status: 400 },
    );
  const input = parsed.data;
  const db = createServiceClient();
  try {
    if (input.action === "resume") {
      const { error } = await db.rpc("resume_engagement_settlement", {
        p_engagement: input.id,
        p_actor: user.id,
        p_reason: input.reason,
      });
      if (error) throw error;
    } else if (input.action === "reset") {
      const { error } = await db.rpc("reset_settlement_reservation", {
        p_ledger: input.ledger,
        p_payment: input.id,
        p_attempt: input.attemptId,
        p_actor: user.id,
        p_reason: input.reason,
      });
      if (error) throw error;
    } else {
      const { data: row, error } = await db
        .from(input.ledger)
        .select("*")
        .eq("id", input.id)
        .eq("release_attempt_id", input.attemptId)
        .single();
      if (error || !row) throw new Error("Reservation changed");
      const { error: auditError } = await db
        .from("settlement_recovery_audit")
        .insert({
          ledger: input.ledger,
          payment_id: input.id,
          attempt_id: input.attemptId,
          actor_id: user.id,
          action: input.action,
          reason: input.reason,
          prior_state: row,
        });
      if (auditError) throw auditError;
      const externalId =
        input.action === "retry"
          ? await retrySettlement(input.ledger, input.id, input.attemptId)
          : input.externalId;
      if (!externalId) throw new Error("Existing Stripe ID required");
      await reconcileSettlementOutcome(input.id, externalId, input.ledger);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[settlement recovery]", error);
    return NextResponse.json(
      {
        error:
          "Recovery was not completed. Refresh the record; unknown outcomes require Stripe verification, and holds require all disputed payments to be resolved.",
      },
      { status: 409 },
    );
  }
}
