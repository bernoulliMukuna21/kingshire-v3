import { redirect } from "next/navigation";
import { CheckCircle2, Zap, Briefcase } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { getUserSubscription } from "@/lib/subscriptions";
import { planForRole } from "@/lib/subscriptions/plans";
import { SMALL_JOB_THRESHOLD_GBP } from "@/lib/payments/policy";
import {
  fulfillUserSubscriptionCheckout,
  UserSubscriptionError,
} from "@/infrastructure/stripe/user-subscriptions";
import {
  SubscribeButton,
  ManageSubscriptionButton,
} from "@/components/subscription/SubscriptionActions";

export default async function KinglancerSubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; cancelled?: string }>;
}) {
  const { session_id, cancelled } = await searchParams;
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
  if (!profile) redirect("/sign-in");
  if (profile.role === "admin") redirect("/admin");
  if (profile.role === "client") redirect("/dashboard/client");
  if (!profile.role) redirect("/onboarding");

  // Confirm immediately on return from Checkout so the page reflects the new
  // subscription without waiting on the webhook. Idempotent.
  if (session_id) {
    try {
      await fulfillUserSubscriptionCheckout(session_id, user.id);
    } catch (err) {
      if (!(err instanceof UserSubscriptionError)) {
        console.error("[subscription] return fulfil failed:", err);
      }
    }
  }

  const subscription = await getUserSubscription(user.id);
  const isActive = subscription?.isActive ?? false;
  const priceGBP = planForRole("kinglancer").priceGBP;

  const renewalDate = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow="Billing"
        title="Kinglancer subscription"
        description="Get paid instantly and apply to more jobs."
      />

      {session_id && isActive && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={16} className="shrink-0" />
          You&apos;re subscribed — instant payouts and small jobs are unlocked.
        </div>
      )}
      {cancelled && !isActive && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Checkout was cancelled. You can subscribe any time.
        </div>
      )}

      <Card className="p-6">
        {isActive ? (
          <>
            <div className="mb-1 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
                <CheckCircle2 size={13} /> Active
              </span>
              {subscription?.cancelAtPeriodEnd && (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-100">
                  Cancels at period end
                </span>
              )}
            </div>
            <h2 className="text-base font-black text-slate-950">
              Your subscription is active
            </h2>
            <p className="mb-5 mt-1 text-sm text-slate-500">
              {subscription?.cancelAtPeriodEnd && renewalDate
                ? `Your subscription ends on ${renewalDate}. Benefits stay available until then.`
                : renewalDate
                  ? `£${priceGBP}/month. Renews on ${renewalDate}.`
                  : `£${priceGBP}/month.`}
            </p>
            <ManageSubscriptionButton />
          </>
        ) : (
          <>
            <h2 className="text-base font-black text-slate-950">
              Subscribe for £{priceGBP}/month
            </h2>
            <p className="mb-5 mt-1 text-sm text-slate-500">
              Unlock instant Stripe payouts and the ability to apply to smaller
              jobs. Without it you&apos;re still paid for every job by manual
              transfer, and can apply to jobs of £{SMALL_JOB_THRESHOLD_GBP} and
              over.
            </p>
            <SubscribeButton priceGBP={priceGBP} />
          </>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-black text-slate-950">
          What it unlocks
        </h3>
        <ul className="space-y-4 text-sm">
          <li className="flex gap-3">
            <Zap size={18} className="mt-0.5 shrink-0 text-blue-600" />
            <span>
              <span className="font-bold text-slate-900">
                Instant Stripe payouts
              </span>
              <span className="block text-slate-500">
                Get paid straight to your account when a client releases escrow,
                instead of waiting for a manual transfer.
              </span>
            </span>
          </li>
          <li className="flex gap-3">
            <Briefcase size={18} className="mt-0.5 shrink-0 text-emerald-600" />
            <span>
              <span className="font-bold text-slate-900">
                Apply to smaller jobs
              </span>
              <span className="block text-slate-500">
                Only subscribers can apply to jobs under £
                {SMALL_JOB_THRESHOLD_GBP}. Larger jobs are open to everyone.
              </span>
            </span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
