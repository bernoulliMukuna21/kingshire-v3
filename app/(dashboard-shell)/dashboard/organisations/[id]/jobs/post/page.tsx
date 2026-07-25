import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrganisationPermission } from "@/lib/organisations";
import { getOrganisationName } from "@/infrastructure/supabase/queries/organisation-queries";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import PostJobForm from "@/app/(dashboard-shell)/jobs/post/PostJobForm";

export default async function OrganisationPostJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!(await requireOrganisationPermission(id, user.id, "manage_jobs"))) notFound();
  const organisationName = await getOrganisationName(id);
  if (!organisationName) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader eyebrow={organisationName} title="Post an Organisation job" description="This is an ordinary paid job owned by the Organisation." />
      <Card className="p-6"><PostJobForm organisationId={id} /></Card>
    </div>
  );
}
