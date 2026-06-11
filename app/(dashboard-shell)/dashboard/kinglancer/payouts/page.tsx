import { redirect } from "next/navigation";
import { CheckCircle, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { syncStripePayoutStatus } from "@/lib/stripe-connect";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, stripe_account_id, stripe_onboarding_complete")
    .eq("id", user.id)
    .single();
  if (profile?.role === "admin") redirect("/admin");
  if (profile?.role === "client") redirect("/dashboard/client");
  if (profile?.role !== "kinglancer") redirect("/onboarding");

  const { status } = await searchParams;
  const isComplete = status === "complete";
  const payoutStatus =
    profile.stripe_account_id && isComplete
      ? await syncStripePayoutStatus({
          kinglancerId: user.id,
          accountId: profile.stripe_account_id,
        }).catch((error) => {
          console.error("[payouts-return] payout status refresh failed", error);
          return {
            detailsSubmitted: profile.stripe_onboarding_complete,
            payoutsEnabled: profile.stripe_onboarding_complete,
          };
        })
      : {
          detailsSubmitted: profile.stripe_onboarding_complete,
          payoutsEnabled: profile.stripe_onboarding_complete,
        };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-3xl items-center justify-center px-4 py-10">
      <Card className="max-w-md p-10 text-center">
        {payoutStatus.payoutsEnabled ? (
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
              Your payout account is ready. Any released payments will be
              transferred to your bank automatically.
            </p>
          </>
        ) : payoutStatus.detailsSubmitted ? (
          <>
            <div className="flex justify-center mb-5">
              <span className="bg-yellow-100 rounded-full p-4">
                <Clock className="text-yellow-600" size={32} />
              </span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">
              Stripe is verifying your details
            </h1>
            <p className="text-gray-500 text-sm mb-8">
              Your bank details were submitted. Once Stripe enables payouts, the
              dashboard will stop showing the setup prompt.
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
        <ButtonLink href="/dashboard/kinglancer">Back to dashboard</ButtonLink>
      </Card>
    </div>
  );
}
