import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function PayoutsReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { status } = await searchParams;
  const isComplete = status === "complete";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
        {isComplete ? (
          <>
            <div className="flex justify-center mb-5">
              <span className="bg-green-100 rounded-full p-4">
                <CheckCircle className="text-green-600" size={32} />
              </span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">
              Payouts connected!
            </h1>
            <p className="text-gray-500 text-sm mb-8">
              Stripe is verifying your details — this usually takes a few
              minutes. Once approved, any released payments will be transferred
              to your bank automatically.
            </p>
          </>
        ) : (
          <>
            <div className="flex justify-center mb-5">
              <span className="bg-yellow-100 rounded-full p-4">
                <Clock className="text-yellow-600" size={32} />
              </span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">
              Setup in progress
            </h1>
            <p className="text-gray-500 text-sm mb-8">
              Your payout setup isn&apos;t complete yet. Head back to your
              dashboard to finish connecting your bank account.
            </p>
          </>
        )}
        <Link
          href="/dashboard/kinglancer"
          className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
