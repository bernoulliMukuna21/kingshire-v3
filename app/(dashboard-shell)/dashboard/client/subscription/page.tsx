import { redirect } from "next/navigation";
import { CheckCircle2, CreditCard, Banknote } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { getClientSubscription } from "@/lib/client-subscription";
import {
  fulfillClientSubscriptionCheckout,
  ClientSubscriptionError,
} from "@/infrastructure/stripe/client-subscriptions";
import {
  SubscribeButton,
  ManageSubscriptionButton,
} from "./SubscriptionActions";

export default async function ClientSubscriptionPage({
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
  if (profile.role === "kinglancer") redirect("/dashboard/kinglancer");
  if (!profile.role) redirect("/onboarding");

  // Confirm immediately on return from Checkout so the page reflects the new
  // subscription without waiting on the webhook. Idempotent; errors are benign
  // (the webhook is the source of truth).
  if (session_id) {
    try {
      await fulfillClientSubscriptionCheckout(session_id, user.id);
    } catch (err) {
      if (!(err instanceof ClientSubscriptionError)) {
        console.error("[client-subscription] return fulfil failed:", err);
      }
    }
  }

  const subscription = await getClientSubscription(user.id);
  const isActive = subscription?.isActive ?? false;

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
        title="Card payments subscription"
        description="Unlock instant card payments for the jobs you fund."
      />

      {session_id && isActive && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={16} className="shrink-0" />
          You&apos;re subscribed — card payments are now unlocked.
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
              Card payments are unlocked
            </h2>
            <p className="mb-5 mt-1 text-sm text-slate-500">
              {subscription?.cancelAtPeriodEnd && renewalDate
                ? `Your subscription ends on ${renewalDate}. Card payments stay available until then.`
                : renewalDate
                  ? `£10/month. Renews on ${renewalDate}.`
                  : "£10/month."}
            </p>
            <ManageSubscriptionButton />
          </>
        ) : (
          <>
            <h2 className="text-base font-black text-slate-950">
              Pay by card for £10/month
            </h2>
            <p className="mb-5 mt-1 text-sm text-slate-500">
              A subscription unlocks the card payment rail for every job you
              fund — instant escrow, no manual step. Without it you can still
              hire and pay by bank transfer at no extra cost.
            </p>
            <SubscribeButton />
          </>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 text-sm font-black text-slate-950">
          How you can pay
        </h3>
        <ul className="space-y-4 text-sm">
          <li className="flex gap-3">
            <CreditCard size={18} className="mt-0.5 shrink-0 text-blue-600" />
            <span>
              <span className="font-bold text-slate-900">
                Card — subscribers only
              </span>
              <span className="block text-slate-500">
                Instant payment held in escrow automatically. Requires the
                £10/month subscription.
              </span>
            </span>
          </li>
          <li className="flex gap-3">
            <Banknote size={18} className="mt-0.5 shrink-0 text-emerald-600" />
            <span>
              <span className="font-bold text-slate-900">
                Bank transfer — always free
              </span>
              <span className="block text-slate-500">
                Available to everyone. We confirm your transfer, then the job
                starts. No subscription needed.
              </span>
            </span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
