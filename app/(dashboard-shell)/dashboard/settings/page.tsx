import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SwitchRoleButton from "@/app/(dashboard-shell)/dashboard/profile/SwitchRoleButton";
import PayoutAccountForm from "./PayoutAccountForm";
import { getPayoutAccount } from "@/lib/db/payout-accounts";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { planForRole } from "@/lib/subscriptions/plans";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, avatar_url")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/sign-in");
  if (profile.role === "admin") redirect("/admin");
  if (!profile.role) redirect("/onboarding");

  const isKinglancer = profile.role === "kinglancer";
  const payoutAccount = isKinglancer ? await getPayoutAccount(user.id) : null;
  const deletionRequestHref = `mailto:kingshirecompany@gmail.com?subject=${encodeURIComponent(
    "KingsHire account deletion request",
  )}&body=${encodeURIComponent(
    `Please delete my KingsHire account.\n\nUser ID: ${user.id}\nEmail: ${user.email ?? ""}\n\nI understand active jobs, payments, disputes, and legally required transaction records may need to be reviewed before deletion is completed.`,
  )}`;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Manage your account preferences and account-level requests."
      />

      <Card className="p-6">
        <h2 className="text-base font-black text-slate-950 mb-1">
          Switch Role
        </h2>
        <p className="text-slate-500 text-sm mb-5">
          You are currently a{" "}
          <span className="font-bold text-slate-800">
            {isKinglancer ? "Kinglancer" : "Client"}
          </span>
          . Switching will move you to the other dashboard.
        </p>
        <SwitchRoleButton currentRole={profile.role} />
      </Card>

      {!isKinglancer && (
        <Card className="p-6">
          <h2 className="text-base font-black text-slate-950 mb-1">
            Card payments
          </h2>
          <p className="text-slate-500 text-sm mb-5">
            Subscribe for £{planForRole("client").priceGBP}/month to pay for
            jobs by card. Bank transfer stays free without a subscription.
          </p>
          <a
            href="/dashboard/client/subscription"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50"
          >
            Manage subscription
          </a>
        </Card>
      )}

      {isKinglancer && (
        <Card className="p-6">
          <h2 className="text-base font-black text-slate-950 mb-1">
            Subscription
          </h2>
          <p className="text-slate-500 text-sm mb-5">
            Subscribe for £{planForRole("kinglancer").priceGBP}/month for
            automatic Stripe payouts and to apply to smaller jobs. Without it
            you&apos;re still paid by manual transfer.
          </p>
          <a
            href="/dashboard/kinglancer/subscription"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50"
          >
            Manage subscription
          </a>
        </Card>
      )}

      {isKinglancer && (
        <PayoutAccountForm
          provider={payoutAccount?.payout_provider ?? null}
          link={payoutAccount?.payout_link ?? null}
        />
      )}

      <Card className="border-red-100 p-6 ring-red-100/60">
        <h2 className="text-base font-black text-slate-950 mb-1">
          Account Deletion
        </h2>
        <p className="text-slate-500 text-sm mb-5">
          For the MVP, deletion requests are reviewed manually so payments,
          jobs, disputes, and required transaction records are handled
          correctly.
        </p>
        <a
          href={deletionRequestHref}
          className="inline-flex items-center justify-center rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors"
        >
          Request account deletion
        </a>
      </Card>
    </div>
  );
}
