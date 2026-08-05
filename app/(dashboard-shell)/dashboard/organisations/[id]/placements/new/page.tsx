import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrganisationPermission } from "@/lib/organisations";
import { getOrganisationName } from "@/infrastructure/supabase/queries/organisation-queries";
import { JOB_CATEGORIES } from "@/lib/job-categories";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
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
  const organisationName = await getOrganisationName(id);
  if (!organisationName) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow={organisationName}
        title="Create a placement"
        description="A supervised experience placement. Be clear about what the participant contributes and what they receive."
      />
      <Card className="p-6">
        <PlacementForm
          organisationId={id}
          categories={JOB_CATEGORIES as unknown as string[]}
        />
      </Card>
    </div>
  );
}
