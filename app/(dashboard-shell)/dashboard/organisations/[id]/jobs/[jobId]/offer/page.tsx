import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrganisationMembership } from "@/lib/organisations";
import { getOrganisationName } from "@/infrastructure/supabase/queries/organisation-queries";
import { getJobById } from "@/lib/db/jobs";
import { getEngagementBySource } from "@/lib/db/engagements";
import { getEngagementPayments } from "@/lib/db/engagement-payments";
import RoleTerminationPanel from "@/components/jobs/RoleTerminationPanel";
import RolePaymentActionButton from "@/components/jobs/RolePaymentActionButton";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import OrganisationWorkspaceHeader from "../../../OrganisationWorkspaceHeader";

export default async function OrganisationRoleOfferPage({
  params,
}: {
  params: Promise<{ id: string; jobId: string }>;
}) {
  const { id: organisationId, jobId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const membership = await getOrganisationMembership(organisationId, user.id);
  if (!membership) notFound();
  const organisationName = await getOrganisationName(organisationId);
  const job = await getJobById(jobId, { useServiceRole: true });
  if (!organisationName || !job || job.organisation_id !== organisationId) notFound();

  const engagement = await getEngagementBySource("org_role", jobId);
  if (!engagement) notFound();
  const payments = await getEngagementPayments(engagement.id);
  const db = createServiceClient();
  const { data: recipient } = await db
    .from("profiles")
    .select("full_name")
    .eq("id", engagement.kinglancer_id)
    .maybeSingle();
  const awaiting = engagement.status === "pending_acceptance";

  return (
    <div className="min-h-screen bg-slate-50">
      <OrganisationWorkspaceHeader
        organisationId={organisationId}
        organisationName={organisationName}
        role={membership.role}
        active="jobs"
        canManageMembers={membership.role === "owner" || membership.role === "admin"}
      />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <Link
          href={`/dashboard/organisations/${organisationId}/jobs/${jobId}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={16} /> Back to job overview
        </Link>

        <Card className="overflow-hidden p-0">
          <div className="bg-[#10234b] px-6 py-7 text-white sm:px-8">
            <StatusBadge className="bg-white/10 text-sky-100 ring-white/15">
              {awaiting ? "Offer" : "Agreement"}
            </StatusBadge>
            <h1 className="mt-4 text-3xl font-black">{job.title}</h1>
            <p className="mt-2 text-sm text-white/70">
              {awaiting
                ? `Awaiting ${recipient?.full_name ?? "the Kinglancer"}'s response`
                : `Agreement with ${recipient?.full_name ?? "the Kinglancer"}`}
            </p>
          </div>
          <div className="grid gap-5 p-6 sm:grid-cols-3 sm:p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Kinglancer</p>
              <p className="mt-2 font-black text-slate-950">{recipient?.full_name ?? "Unknown"}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Agreed pay</p>
              <p className="mt-2 font-black text-emerald-600">£{Number(engagement.amount_per_period ?? 0).toFixed(2)} / {engagement.cadence}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Arrangement</p>
              <p className="mt-2 font-black text-slate-950">{engagement.settlement_mode === "managed" ? "KingsHire-managed" : "Direct settlement"}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 sm:p-8">
          <h2 className="text-lg font-black text-slate-950">Activity</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Offer sent{engagement.org_signed_at ? ` · ${new Date(engagement.org_signed_at).toLocaleDateString("en-GB")}` : ""}</p>
            <p className="flex items-center gap-3"><span className={`h-2 w-2 rounded-full ${awaiting ? "bg-slate-300" : "bg-emerald-500"}`} /> {awaiting ? "Awaiting response" : "Accepted"}</p>
            {!awaiting && <p className="flex items-center gap-3"><span className="h-2 w-2 rounded-full bg-slate-300" /> First payment and ongoing work</p>}
          </div>
        </Card>

        {payments.length > 0 && (
          <Card className="p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-950">Payments</h2>
                <p className="mt-1 text-sm text-slate-500">Scheduled periods for this agreement.</p>
              </div>
              <CreditCard className="text-slate-400" size={20} />
            </div>
            <div className="mt-5 divide-y divide-slate-100">
              {payments.map((payment) => (
                <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <span className="font-semibold text-slate-700">Period {payment.period_index} · {payment.due_date}</span>
                  <span className="flex items-center gap-3 font-bold capitalize text-slate-600">
                    {payment.status}
                    {payment.status === "processing" && payment.stripe_payment_intent_id && (
                      <RolePaymentActionButton organisationId={organisationId} paymentId={payment.id} />
                    )}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-6 sm:p-8">
          <RoleTerminationPanel
            jobId={jobId}
            status={engagement.status}
            endRequestedBy={engagement.end_requested_by}
            viewerId={user.id}
            kinglancerId={engagement.kinglancer_id}
          />
        </Card>
      </main>
    </div>
  );
}