import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { stripe } from "@/lib/stripe";
import { updateTransactionStatus } from "@/lib/db/transactions";

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

  if (redirect_status === "succeeded" && payment_intent) {
    // Verify with Stripe and mark the transaction as held
    try {
      const pi = await stripe.paymentIntents.retrieve(payment_intent);
      if (pi.status === "succeeded" && pi.metadata.job_id === id) {
        await updateTransactionStatus(payment_intent, "held");
        success = true;
      }
    } catch {
      // leave success = false
    }
  }

  // Payment failed or was cancelled — redirect back to the job page with a
  // banner param so the client knows they need to try again.
  if (!success) {
    redirect(`/jobs/${id}?payment_failed=1`);
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
