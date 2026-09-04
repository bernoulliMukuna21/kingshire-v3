import { Suspense } from "react";
import {
  getPendingPaymentAttemptByJob,
  isCancellablePaymentIntentStatus,
} from "@/lib/db/payment-attempts";
import { getManualBankDetails } from "@/lib/manual-payments";
import { stripe } from "@/lib/stripe";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import CancelPaymentButton from "./CancelPaymentButton";

/**
 * Fetches the pending Stripe payment intent and renders the "resume payment"
 * card. Separated into its own server component so it can be wrapped in
 * Suspense — the Stripe API call (~100-200ms) no longer blocks the initial
 * page render; this section streams in once Stripe responds.
 */
async function PendingPaymentCardInner({ jobId }: { jobId: string }) {
  const pendingAttempt = await getPendingPaymentAttemptByJob(jobId);
  if (!pendingAttempt) return null;

  // Bank transfer (manual): no Stripe intent — show our details + reference and
  // that we're waiting to confirm the funds, not a failed card payment.
  if (pendingAttempt.method === "bank_transfer") {
    const bank = getManualBankDetails();
    return (
      <Card className="border-blue-200 bg-blue-50 p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100">
            <span className="text-sm">🏦</span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black text-blue-900">
              Bank transfer pending
            </h2>
            <p className="mt-1 text-sm text-blue-700">
              We&apos;re waiting for your transfer to arrive. Once we confirm
              it, your Kinglancer is hired and the job starts.
            </p>
            {bank && (
              <div className="mt-3 space-y-1 rounded-xl border border-blue-200 bg-white/60 p-3 font-mono text-xs text-blue-900">
                <div>Account name: {bank.accountName}</div>
                <div>Sort code: {bank.sortCode}</div>
                <div>Account number: {bank.accountNumber}</div>
              </div>
            )}
            <p className="mt-2 text-sm text-blue-700">
              Reference:{" "}
              <strong className="font-mono">
                {pendingAttempt.id.slice(0, 8)}
              </strong>
            </p>
            {bank?.isPlaceholder && (
              <p className="mt-1 text-xs font-bold text-amber-700">
                TEST details — do not send real money.
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <CancelPaymentButton jobId={jobId} />
        </div>
      </Card>
    );
  }

  let pendingClientSecret: string | null = null;
  if (pendingAttempt.stripe_payment_intent_id) {
    try {
      const pi = await stripe.paymentIntents.retrieve(
        pendingAttempt.stripe_payment_intent_id,
      );
      if (pi.client_secret && isCancellablePaymentIntentStatus(pi.status)) {
        pendingClientSecret = pi.client_secret;
      }
    } catch {
      // PI not found (e.g. Stripe mode mismatch) — still offer cancel.
    }
  }

  return (
    <Card className="border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100">
          <span className="text-sm">⏳</span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-black text-amber-900">
            Payment not completed
          </h2>
          <p className="mt-1 text-sm text-amber-700">
            Your escrow payment was started but not finished. Resume to lock in
            your Kinglancer, or cancel it to change your decision.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {pendingClientSecret && (
          <ButtonLink href={`/jobs/${jobId}/pay?cs=${pendingClientSecret}`}>
            Resume payment
          </ButtonLink>
        )}
        <CancelPaymentButton jobId={jobId} />
      </div>
    </Card>
  );
}

export default function PendingPaymentCard({ jobId }: { jobId: string }) {
  return (
    <Suspense fallback={null}>
      <PendingPaymentCardInner jobId={jobId} />
    </Suspense>
  );
}
