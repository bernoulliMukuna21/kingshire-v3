import { redirect } from "next/navigation";
import { CheckCircle2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { organisationRepository } from "@/infrastructure/supabase/repositories/supabase-organisation-repository";
import InviteMemberForm from "@/app/(dashboard-shell)/dashboard/organisations/[id]/InviteMemberForm";
import { ButtonLink } from "@/components/ui/Button";
import OrganisationSetupShell from "@/components/organisations/OrganisationSetupShell";

export default async function OrganisationTeamSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ organisation_id?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/dashboard/organisations");

  const { organisation_id: organisationId } = await searchParams;
  if (!organisationId) redirect("/dashboard/organisations");

  const membership = await organisationRepository.findMembership(
    organisationId,
    user.id,
  );
  if (membership?.role !== "owner") redirect("/dashboard/organisations");

  return (
    <OrganisationSetupShell currentStep="team">
      <main>
        <div className="mx-auto max-w-3xl">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-9">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 size={28} />
            </div>
            <p className="mt-6 text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
              Organisation ready
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">
              Bring your team with you
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-slate-600">
              Invite a colleague now, or skip this step and manage members from
              the workspace whenever you are ready.
            </p>

            <div className="mt-7 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="mb-4 flex items-center gap-3">
                <Users className="text-blue-700" size={22} />
                <p className="font-black text-slate-950">Invite a colleague</p>
              </div>
              <InviteMemberForm
                organisationId={organisationId}
                canInviteAdmin
              />
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <ButtonLink
                href={`/organisation/setup/finished?organisation_id=${organisationId}`}
                variant="secondary"
                size="lg"
              >
                Finish without another invite
              </ButtonLink>
              <ButtonLink
                href={`/organisation/setup/finished?organisation_id=${organisationId}`}
                size="lg"
              >
                Continue
              </ButtonLink>
            </div>
          </div>
        </div>
      </main>
    </OrganisationSetupShell>
  );
}
