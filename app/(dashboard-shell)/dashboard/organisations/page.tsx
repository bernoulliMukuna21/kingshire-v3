import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserOrganisationSummaries } from "@/infrastructure/supabase/queries/organisation-queries";
import PageHeader from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

export default async function OrganisationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const organisations = await getUserOrganisationSummaries(user.id);

  return (
    <div className="mx-auto max-w-5xl space-y-7 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Workspaces"
        title="Your Organisations"
        description="Create or open an Organisation workspace."
        action={<ButtonLink href="/organisation/setup">Create Organisation</ButtonLink>}
      />
      {!organisations.length ? (
        <EmptyState title="No Organisations yet" description="Create an Organisation or accept an invitation to join one." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {organisations.map((organisation) => {
            return (
              <Link key={organisation.id} href={`/dashboard/organisations/${organisation.id}`}>
                <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-blue-200">
                  <p className="text-lg font-black text-slate-950">{organisation.name}</p>
                  <p className="mt-1 text-sm capitalize text-slate-500">
                    {organisation.organisation_type.replaceAll("_", " ")}
                    {organisation.location ? ` · ${organisation.location}` : ""}
                  </p>
                  <span className="mt-4 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold capitalize text-blue-700">
                    {organisation.role}
                  </span>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
