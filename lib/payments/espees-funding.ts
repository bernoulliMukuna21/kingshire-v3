import { calculateFees } from "@/lib/stripe";
import { gbpToEspees } from "@/lib/espees-fx";
import { createEspeesProduct, espeesPayUrl } from "@/lib/espees";
import {
  createPaymentAttempt,
  setEspeesPaymentRef,
  cancelPaymentAttemptById,
  type PaymentAttemptRow,
} from "@/lib/db/payment-attempts";

export type JobPaymentMethod = "card" | "bank_transfer" | "espees";

// Single source of truth for reading a requested rail off a request body.
export function parseJobPaymentMethod(raw: unknown): JobPaymentMethod {
  if (raw === "bank_transfer") return "bank_transfer";
  if (raw === "espees") return "espees";
  return "card";
}

export type EspeesEscrowResult =
  | { ok: true; reference: string; payUrl: string; amountEsp: number }
  | { ok: false; error: string; status: number };

type EspeesEscrowContext = {
  jobId: string;
  jobTitle: string;
  budget: number;
  clientId: string;
  attemptType: PaymentAttemptRow["attempt_type"];
  applicationId: string | null;
  kinglancerId: string;
  // A pending attempt already on this job, if any (caller has verified it
  // belongs to this hire).
  existingAttempt: PaymentAttemptRow | null;
};

// Start (or resume) an Espees escrow funding for a job hire — used by both the
// application-accept and direct-request payment routes so the rail lives in one
// place. Espees settles into our merchant wallet, so this mirrors the manual
// bank-transfer attempt (no PaymentIntent) but hands back a hosted pay URL.
export async function startEspeesJobEscrow(
  ctx: EspeesEscrowContext,
): Promise<EspeesEscrowResult> {
  const { existingAttempt } = ctx;

  // Resume an in-flight espees attempt rather than opening a second one.
  if (existingAttempt?.method === "espees") {
    if (!existingAttempt.espees_payment_ref) {
      return {
        ok: false,
        error: "Could not resume the Espees payment. Cancel it and try again.",
        status: 409,
      };
    }
    return {
      ok: true,
      reference: existingAttempt.id,
      payUrl: espeesPayUrl(existingAttempt.espees_payment_ref),
      amountEsp: existingAttempt.espees_amount ?? 0,
    };
  }
  if (existingAttempt) {
    return {
      ok: false,
      error: "A payment is already pending for this job. Cancel it first.",
      status: 409,
    };
  }

  // Espees carries no card fee, so drop the fixed component (as bank transfer).
  const { platformFeeClient, platformFeeKinglancer } = calculateFees(
    ctx.budget,
    { includeFixed: false },
  );
  const quote = await gbpToEspees(ctx.budget + platformFeeClient);

  const attempt = await createPaymentAttempt({
    job_id: ctx.jobId,
    application_id: ctx.applicationId,
    client_id: ctx.clientId,
    kinglancer_id: ctx.kinglancerId,
    amount: ctx.budget,
    platform_fee_client: platformFeeClient,
    platform_fee_kinglancer: platformFeeKinglancer,
    stripe_payment_intent_id: null,
    method: "espees",
    espees_amount: quote.esp,
    attempt_type: ctx.attemptType,
    status: "pending",
  });

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const product = await createEspeesProduct({
      productSku: attempt.id,
      narration: `KingsHire — ${ctx.jobTitle}`,
      priceEsp: quote.esp,
      successUrl: `${appUrl}/jobs/${ctx.jobId}/espees/return?attempt=${attempt.id}`,
      failUrl: `${appUrl}/jobs/${ctx.jobId}?espees=cancelled`,
      userData: {
        job_id: ctx.jobId,
        client_id: ctx.clientId,
        attempt_id: attempt.id,
      },
    });
    await setEspeesPaymentRef(attempt.id, product.paymentRef);
    return {
      ok: true,
      reference: attempt.id,
      payUrl: product.payUrl,
      amountEsp: quote.esp,
    };
  } catch (err) {
    await cancelPaymentAttemptById(attempt.id);
    throw err;
  }
}
