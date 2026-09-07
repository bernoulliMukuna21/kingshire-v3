import { NextResponse } from "next/server";
import {
  getPendingEspeesAttempts,
  finalizeEspeesPayment,
  cancelPaymentAttemptById,
} from "@/lib/db/payment-attempts";
import { confirmEspeesPayment } from "@/lib/espees";

// Don't re-confirm an attempt until the payer's redirect-back has had a chance.
const MIN_AGE_MS = 3 * 60 * 1000; // 3 minutes
// Give up on an unpaid attempt after this long (declined / abandoned).
const STALE_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

// GET /api/cron/espees-reconcile
// Re-confirms pending Espees payments (Espees has no webhook), so a closed tab
// or a slow-settling PENDING still funds escrow. Idempotent. Secured via
// CRON_SECRET, matching the other cron endpoints.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error("CRON_SECRET is not set in production");
      return NextResponse.json({ error: "Not configured" }, { status: 500 });
    }
  } else {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
  }

  const attempts = await getPendingEspeesAttempts(MIN_AGE_MS);
  let funded = 0;
  let cancelled = 0;

  for (const attempt of attempts) {
    if (!attempt.espees_payment_ref) continue;
    let status: string;
    try {
      const result = await confirmEspeesPayment(attempt.espees_payment_ref);
      status = result.status;
    } catch {
      continue; // transient — try again next run
    }

    if (status === "APPROVED") {
      try {
        await finalizeEspeesPayment(attempt.id);
        funded += 1;
      } catch (err) {
        console.error("[espees-reconcile] finalize failed", attempt.id, err);
      }
      continue;
    }

    // Give up on declined / not-found / abandoned attempts once they're stale.
    const ageMs = Date.now() - new Date(attempt.created_at).getTime();
    if (status !== "PENDING" && ageMs > STALE_MS) {
      await cancelPaymentAttemptById(attempt.id).catch(() => {});
      cancelled += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    checked: attempts.length,
    funded,
    cancelled,
  });
}
