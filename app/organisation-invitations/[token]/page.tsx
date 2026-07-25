import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrganisationInvitationView } from "@/infrastructure/supabase/queries/organisation-queries";
import PublicShell from "@/components/ui/PublicShell";
import { Card } from "@/components/ui/Card";
import AcceptInvitationButton from "./AcceptInvitationButton";

export default async function OrganisationInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=/organisation-invitations/${token}`);
  const invitation = await getOrganisationInvitationView(token);
  return (
    <PublicShell>
      <main className="mx-auto max-w-xl px-4 py-16">
        <Card className="p-8">
          <h1 className="text-2xl font-black text-slate-950">Organisation invitation</h1>
          {invitation ? (
            <>
              <p className="my-5 text-sm leading-6 text-slate-600">You have been invited to join <strong>{invitation.organisationName}</strong> as {invitation.role}.</p>
              <AcceptInvitationButton token={token} />
            </>
          ) : <p className="mt-5 text-sm text-red-600">This invitation is invalid, expired, or already accepted.</p>}
        </Card>
      </main>
    </PublicShell>
  );
}
