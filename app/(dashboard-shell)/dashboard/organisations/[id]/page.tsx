import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrganisationMembership } from "@/lib/organisations";
import { getOrganisationOverview } from "@/infrastructure/supabase/queries/organisation-queries";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import OrganisationWorkspaceHeader from "./OrganisationWorkspaceHeader";
import InviteMemberForm from "./InviteMemberForm";
import MemberActions from "./MemberActions";
import OrganisationSettings from "./OrganisationSettings";
import TransferOwnership from "./TransferOwnership";
import BillingPortalButton from "./BillingPortalButton";
import DeleteOrganisation from "./DeleteOrganisation";
import { getOrganisationPlan } from "@/modules/organisations/domain/plans";

export default async function OrganisationDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const membership = await getOrganisationMembership(id, user.id);
  if (!membership) notFound();

  const overview = await getOrganisationOverview(id);
  if (!overview) notFound();
  const { organisation, jobs, members, stats, subscription } = overview;
  const canManageMembers = membership.role === "owner" || membership.role === "admin";

  const validTabs = ["overview", "team", ...(canManageMembers ? ["settings"] : [])];
  const activeTab = validTabs.includes(tab ?? "") ? (tab as string) : "overview";

  return (
    <div className="mx-auto max-w-6xl space-y-7 px-4 py-8 sm:px-6">
      <OrganisationWorkspaceHeader
        organisationId={id}
        organisationName={organisation.name}
        role={membership.role}
        subtitle={[organisation.organisation_type?.replaceAll("_", " "), organisation.location].filter(Boolean).join(" · ")}
        active={activeTab}
        canManageMembers={canManageMembers}
        action={<ButtonLink href={`/dashboard/organisations/${id}/jobs/post`}>Post a job</ButtonLink>}
      />

      {activeTab === "overview" && (
        <div className="space-y-7">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-5"><p className="text-xs font-bold uppercase text-slate-400">Jobs</p><p className="mt-2 text-3xl font-black">{stats.jobCount}</p></Card>
            <Card className="p-5"><p className="text-xs font-bold uppercase text-slate-400">Members</p><p className="mt-2 text-3xl font-black">{stats.memberCount}</p></Card>
            <Card className="p-5"><p className="text-xs font-bold uppercase text-slate-400">Released spend</p><p className="mt-2 text-3xl font-black">£{stats.releasedSpend.toFixed(2)}</p></Card>
          </div>
          <section>
            <h2 className="mb-3 text-xl font-black text-slate-950">Organisation jobs</h2>
            {!jobs.length ? (
              <EmptyState title="No jobs yet" description="Post the Organisation's first paid job." action={<ButtonLink href={`/dashboard/organisations/${id}/jobs/post`}>Post a job</ButtonLink>} />
            ) : (
              <Card className="divide-y divide-slate-100 overflow-hidden">
                {jobs.map((job) => (
                  <Link key={job.id} href={`/dashboard/client/jobs/${job.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50">
                    <div><p className="font-bold text-slate-950">{job.title}</p><p className="mt-1 text-xs capitalize text-slate-500">{job.status.replaceAll("_", " ")}</p></div>
                    <p className="font-black">£{Number(job.budget).toFixed(2)}</p>
                  </Link>
                ))}
              </Card>
            )}
          </section>
        </div>
      )}

      {activeTab === "team" && (
        <section>
          <h2 className="mb-3 text-xl font-black text-slate-950">Team</h2>
          <Card className="space-y-5 p-5">
            {canManageMembers && (
              <InviteMemberForm
                organisationId={id}
                canInviteAdmin={membership.role === "owner"}
              />
            )}
            <div className="divide-y divide-slate-100">
              {members.map((member) => {
                const profile = member.profile;
                return (
                  <div key={member.userId} className="flex items-center justify-between py-3">
                    <div><p className="font-bold text-slate-950">{profile.full_name}</p><p className="text-xs text-slate-500">{profile.email}</p></div>
                    <MemberActions
                      organisationId={id}
                      userId={member.userId}
                      role={member.role}
                      actorRole={membership.role}
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        </section>
      )}

      {activeTab === "settings" && canManageMembers && (
        <div className="space-y-7">
          <section>
            <h2 className="mb-3 text-xl font-black text-slate-950">Organisation profile</h2>
            <Card className="p-5">
              <OrganisationSettings organisation={organisation} />
            </Card>
          </section>
          {membership.role === "owner" && subscription && (
            <section>
              <h2 className="mb-3 text-xl font-black text-slate-950">Subscription</h2>
              <Card className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black text-slate-950">
                    {getOrganisationPlan(subscription.plan).name} · £
                    {getOrganisationPlan(subscription.plan).monthlyPriceGBP}/month
                  </p>
                  <p className="mt-1 text-sm capitalize text-slate-600">
                    {subscription.status.replaceAll("_", " ")}
                    {subscription.cancel_at_period_end
                      ? " · Cancels at the end of the billing period"
                      : ""}
                  </p>
                  {subscription.current_period_end && (
                    <p className="mt-1 text-xs text-slate-500">
                      {subscription.cancel_at_period_end
                        ? "Access until"
                        : "Renews"}{" "}
                      {new Intl.DateTimeFormat("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(subscription.current_period_end))}
                    </p>
                  )}
                </div>
                <BillingPortalButton organisationId={id} />
              </Card>
            </section>
          )}
          {membership.role === "owner" && (
            <section>
              <h2 className="mb-3 text-xl font-black text-slate-950">Ownership</h2>
              <Card className="p-5">
                <p className="mb-4 text-sm text-slate-600">
                  Transfer ownership to an existing member. You will become an Admin.
                </p>
                <TransferOwnership
                  organisationId={id}
                  members={members
                    .filter((member) => member.userId !== user.id)
                    .map((member) => ({
                      userId: member.userId,
                      name: member.profile.full_name,
                    }))}
                />
              </Card>
            </section>
          )}
          {membership.role === "owner" && (
            <section>
              <h2 className="mb-3 text-xl font-black text-red-700">Danger zone</h2>
              <Card className="p-5">
                <DeleteOrganisation
                  organisationId={id}
                  organisationName={organisation.name}
                />
              </Card>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
