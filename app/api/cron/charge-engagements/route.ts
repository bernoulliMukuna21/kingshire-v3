import { recoverAcceptedSchedules } from "@/lib/settlement/hiring-recovery";
import { NextResponse } from "next/server";
import { getDueEngagementPayments } from "@/lib/db/engagement-payments";
import { recoverEngagementPayments } from "@/lib/settlement/recovery";
import { chargeEngagementPayment } from "@/lib/settlement/billing";

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

// GET /api/cron/charge-engagements
export async function GET(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const setupErrors = await recoverAcceptedSchedules();
  const recovery = await recoverEngagementPayments();

  const today = new Date().toISOString().slice(0, 10);
  const payments = await getDueEngagementPayments(today);
  const summary = {
    checked: payments.length,
    recovery,
    errors: setupErrors,
    charged: 0,
    reconciliationPending: 0,
    alreadyProcessed: 0,
    failed: 0,
    noPaymentMethod: 0,
    notChargeable: 0,
  };

  for (const payment of payments) {
    try {
      const result = await chargeEngagementPayment(payment.id);
      if (result === "charged") summary.charged += 1;
      if (result === "reconciliation_pending")
        summary.reconciliationPending += 1;
      if (result === "already_processed") summary.alreadyProcessed += 1;
      if (result === "failed") summary.failed += 1;
      if (result === "no_payment_method") summary.noPaymentMethod += 1;
      if (result === "not_chargeable") summary.notChargeable += 1;
    } catch (error) {
      summary.errors.push(
        `${payment.id}: ${error instanceof Error ? error.message : "Charge failed"}`,
      );
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}
