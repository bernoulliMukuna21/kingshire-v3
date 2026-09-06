import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrganisationMembership } from "@/lib/organisations";
import { getOrganisationName } from "@/infrastructure/supabase/queries/organisation-queries";
import JobDetailWorkspace from "@/components/jobs/JobDetailWorkspace";
import OrganisationWorkspaceHeader from "../../OrganisationWorkspaceHeader";

export default async function OrganisationJobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; jobId: string }>;
  searchParams: Promise<{ payment_failed?: string; from?: string }>;
}) {
  const { id, jobId } = await params;
  const { payment_failed, from } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const membership = await getOrganisationMembership(id, user.id);
  if (!membership) notFound();
  const organisationName = await getOrganisationName(id);
  if (!organisationName) notFound();

  const canManageMembers =
    membership.role === "owner" || membership.role === "admin";

  return (
    <JobDetailWorkspace
      jobId={jobId}
      from={from}
      paymentFailed={payment_failed}
      organisationId={id}
      header={
        <OrganisationWorkspaceHeader
          organisationId={id}
          organisationName={organisationName}
          role={membership.role}
          active="jobs"
          canManageMembers={canManageMembers}
        />
      }
    />
  );
}
