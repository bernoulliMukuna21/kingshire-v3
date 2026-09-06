import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { organisationRepository } from "@/infrastructure/supabase/repositories/supabase-organisation-repository";
import OrganisationSetupShell from "@/components/organisations/OrganisationSetupShell";
import { ButtonLink } from "@/components/ui/Button";

export default async function OrganisationSetupFinishedPage({
  searchParams,
}: {
  searchParams: Promise<{ organisation_id?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/organisation/setup");

  const { organisation_id: organisationId } = await searchParams;
  if (!organisationId) redirect("/dashboard/organisations");

  const membership = await organisationRepository.findMembership(
    organisationId,
    user.id,
  );
  if (membership?.role !== "owner") redirect("/dashboard/organisations");

  return (
    <OrganisationSetupShell currentStep="complete">
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-7 text-center shadow-xl shadow-slate-900/5 sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <CheckCircle2 size={34} />
        </div>
        <p className="mt-6 text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
          Setup complete
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          Your Organisation workspace is ready
        </h1>
        <p className="mx-auto mt-4 max-w-xl leading-7 text-slate-600">
          You are its Owner. You can now publish paid jobs, manage applicants,
          invite colleagues and control the subscription from one workspace.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink
            href="/dashboard/organisations"
            variant="secondary"
            size="lg"
          >
            View all Organisations
          </ButtonLink>
          <ButtonLink
            href={`/dashboard/organisations/${organisationId}`}
            size="lg"
          >
            Enter workspace
          </ButtonLink>
        </div>
      </div>
    </OrganisationSetupShell>
  );
}
