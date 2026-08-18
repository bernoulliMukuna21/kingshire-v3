import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getOrganisationMembership,
  requireOrganisationPermission,
} from "@/lib/organisations";
import { getOrganisationName } from "@/infrastructure/supabase/queries/organisation-queries";
import { JOB_CATEGORIES } from "@/lib/job-categories";
import { Card } from "@/components/ui/Card";
import OrganisationWorkspaceHeader from "../../OrganisationWorkspaceHeader";
import PlacementForm from "./PlacementForm";

export default async function NewPlacementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!(await requireOrganisationPermission(id, user.id, "manage_jobs"))) {
    notFound();
  }
  const membership = await getOrganisationMembership(id, user.id);
  if (!membership) notFound();
  const organisationName = await getOrganisationName(id);
  if (!organisationName) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <OrganisationWorkspaceHeader
        organisationId={id}
        organisationName={organisationName}
        role={membership.role}
        active="placements"
        canManageMembers={
          membership.role === "owner" || membership.role === "admin"
        }
      />
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div>
          <Link
            href={`/dashboard/organisations/${id}/placements`}
            className="text-sm font-bold text-blue-700 hover:text-blue-800"
          >
            ← Back to placements
          </Link>
          <h1 className="mt-2 text-2xl font-black text-slate-950">
            Create a placement
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            A supervised experience placement. Be clear about what the
            participant contributes and what they receive.
          </p>
        </div>
        <Card className="p-6">
          <PlacementForm
            organisationId={id}
            categories={JOB_CATEGORIES as unknown as string[]}
          />
        </Card>
      </div>
    </div>
  );
}
