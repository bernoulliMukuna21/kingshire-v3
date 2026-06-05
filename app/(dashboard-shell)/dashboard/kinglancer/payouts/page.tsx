import { redirect } from "next/navigation";
import { CheckCircle, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";

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
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role === "admin") redirect("/admin");
  if (profile?.role === "client") redirect("/dashboard/client");
  if (profile?.role !== "kinglancer") redirect("/onboarding");

  const { status } = await searchParams;
  const isComplete = status === "complete";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-3xl items-center justify-center px-4 py-10">
      <Card className="max-w-md p-10 text-center">
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
        <ButtonLink href="/dashboard/kinglancer">Back to dashboard</ButtonLink>
      </Card>
    </div>
  );
}
