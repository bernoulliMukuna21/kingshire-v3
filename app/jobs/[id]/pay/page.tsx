import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getJobById } from "@/lib/db/jobs";
import { getTransactionByJob } from "@/lib/db/transactions";
import PaymentForm from "./PaymentForm";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cs?: string }>;
}

export default async function PayPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { cs: clientSecret } = await searchParams;

  if (!clientSecret) redirect(`/jobs/${id}`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const job = await getJobById(id);
  if (!job) redirect("/jobs");

  const transaction = await getTransactionByJob(id);

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
              <span className="font-medium shrink-0">
                £{job.budget.toFixed(2)}
              </span>
            </div>
            {transaction && (
              <div className="flex justify-between text-gray-500">
                <span>Platform fee (5%)</span>
                <span>£{transaction.platform_fee_client.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-gray-900">
              <span>Total charged today</span>
              <span>
                £
                {transaction
                  ? (job.budget + transaction.platform_fee_client).toFixed(2)
                  : (job.budget * 1.05).toFixed(2)}
              </span>
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
        />
      </div>
    </div>
  );
}
