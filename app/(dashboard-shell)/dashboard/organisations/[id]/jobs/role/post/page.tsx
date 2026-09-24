import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrganisationPermission, getOrganisationMembership } from "@/lib/organisations";
import { getOrganisationName } from "@/infrastructure/supabase/queries/organisation-queries";
import OrganisationWorkspaceHeader from "../../../OrganisationWorkspaceHeader";
import { Card } from "@/components/ui/Card";
import OrganisationRoleForm from "../../post/OrganisationRoleForm";

export default async function OrganisationRolePostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!(await requireOrganisationPermission(id, user.id, "manage_jobs"))) notFound();
  const membership = await getOrganisationMembership(id, user.id);
  const organisationName = await getOrganisationName(id);
  if (!membership || !organisationName) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <OrganisationWorkspaceHeader
        organisationId={id}
        organisationName={organisationName}
        role={membership.role}
        active="jobs"
        canManageMembers={membership.role === "owner" || membership.role === "admin"}
      />
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Organisation role</p>
        <h1 className="mt-1 text-3xl font-black text-slate-950">Post a recurring role</h1>
        <p className="mt-2 text-sm text-slate-500">Create a permanent or temporary role with weekly or monthly pay.</p>
      </div>
      <Card className="p-6">
        <OrganisationRoleForm organisationId={id} />
      </Card>
    </div>
  );
}
