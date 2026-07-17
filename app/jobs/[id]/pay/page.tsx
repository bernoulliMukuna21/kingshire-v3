import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getJobById } from "@/lib/db/jobs";
import {
  getPaymentAttemptByPaymentIntent,
  getPaymentIntentIdFromClientSecret,
} from "@/lib/db/payment-attempts";
import { getTransactionByPaymentIntent } from "@/lib/db/transactions";
import PaymentForm from "./PaymentForm";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cs?: string; debug?: string }>;
}

export default async function PayPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { cs: clientSecret, debug } = await searchParams;

  if (!clientSecret) redirect(`/jobs/${id}`);
  const paymentIntentId = getPaymentIntentIdFromClientSecret(clientSecret);
  if (!paymentIntentId) redirect(`/jobs/${id}`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const job = await getJobById(id);
  if (!job) redirect("/jobs");

  const paymentAttempt =
    await getPaymentAttemptByPaymentIntent(paymentIntentId);
  const legacyTransaction =
    paymentAttempt === null
      ? await getTransactionByPaymentIntent(paymentIntentId)
      : null;

  if (paymentAttempt) {
    if (
      paymentAttempt.job_id !== id ||
      paymentAttempt.client_id !== user.id ||
      paymentAttempt.status !== "pending"
    ) {
      redirect(`/jobs/${id}`);
    }
  } else if (
    !legacyTransaction ||
    legacyTransaction.job_id !== id ||
    legacyTransaction.client_id !== user.id ||
    legacyTransaction.status !== "pending"
  ) {
    redirect(`/jobs/${id}`);
  }

  const amount =
    paymentAttempt?.amount ?? legacyTransaction?.amount ?? job.budget;
  const platformFee =
    paymentAttempt?.platform_fee_client ??
    legacyTransaction?.platform_fee_client ??
    amount * 0.025;

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center py-16 px-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Complete your payment
          </h1>
          <p className="mt-1 text-gray-500 text-sm">
            Funds are held in escrow until the work is approved.
          </p>
        </div>

        {/* Order summary */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
          <h2 className="font-semibold text-gray-900 text-sm uppercase tracking-wide">
            Order Summary
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-700">
              <span className="truncate pr-4">{job.title}</span>
              <span className="font-medium shrink-0">£{amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Platform fee (2.5%)</span>
              <span>£{platformFee.toFixed(2)}</span>
            </div>
            <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-gray-900">
              <span>Total charged today</span>
              <span>£{(amount + platformFee).toFixed(2)}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 border-t border-gray-50 pt-3">
            Your payment is held securely in escrow. It will only be released to
            the Kinglancer once you approve the completed work.
          </p>
        </div>

        {/* Stripe payment form */}
        <PaymentForm
          clientSecret={clientSecret}
          jobId={id}
          jobTitle={job.title}
          debug={debug === "1"}
        />
      </div>
    </div>
  );
}
