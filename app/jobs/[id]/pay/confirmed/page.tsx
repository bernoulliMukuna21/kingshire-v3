import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { stripe } from "@/lib/stripe";
import { finalizePaymentAttempt } from "@/lib/db/payment-attempts";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    payment_intent?: string;
    payment_intent_client_secret?: string;
    redirect_status?: string;
  }>;
}

export default async function PayConfirmedPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const { payment_intent, redirect_status } = await searchParams;

  let success = false;
  let explicitFailure = false;

  // Never rely only on redirect_status. Depending on payment method/browser
  // timing, Stripe can redirect before the backend has finalized state.
  if (payment_intent) {
    try {
      const pi = await stripe.paymentIntents.retrieve(payment_intent);

      if (pi.metadata.job_id !== id) {
        explicitFailure = true;
      } else if (pi.status === "succeeded") {
        // Treat a verified succeeded PI as success even if finalization races
        // with the webhook and throws an idempotency conflict.
        try {
          await finalizePaymentAttempt(payment_intent);
        } catch (err) {
          console.warn("[pay/confirmed] finalizePaymentAttempt race:", err);
        }
        success = true;
      } else if (
        pi.status === "canceled" ||
        pi.status === "requires_payment_method"
      ) {
        explicitFailure = true;
      }
    } catch (err) {
      console.warn("[pay/confirmed] Could not retrieve PaymentIntent:", err);
    }
  }

  // Stripe can still signal explicit failure via redirect status.
  if (redirect_status === "failed") {
    explicitFailure = true;
  }

  if (explicitFailure && !success) {
    redirect(`/jobs/${id}?payment_failed=1`);
  }

  // Unknown/pending callback state: return to job without a false failure
  // banner. The webhook/confirmation endpoint will converge state.
  if (!success) {
    redirect(`/jobs/${id}`);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-10 max-w-md w-full text-center space-y-5">
        <CheckCircle size={48} className="text-green-500 mx-auto" />
        <h1 className="text-2xl font-bold text-gray-900">Payment received!</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          Your payment is safely held in escrow. The Kinglancer has been
          notified and will start work. Once they mark it as done, you&apos;ll
          be asked to approve and release the payment.
        </p>
        <div className="flex flex-col gap-3 pt-2">
          <Link
            href={`/jobs/${id}`}
            className="block w-full py-3 bg-[#1a2e5a] text-white font-bold rounded-xl hover:bg-[#1e3a7a] transition-colors"
          >
            View job
          </Link>
          <Link
            href="/dashboard/client"
            className="block w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
