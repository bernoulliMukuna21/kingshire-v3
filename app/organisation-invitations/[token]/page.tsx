import Link from "next/link";
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
  const invitation = await getOrganisationInvitationView(token);
  const invitationPath = `/organisation-invitations/${token}`;
  const authQuery = `?next=${encodeURIComponent(invitationPath)}`;
  return (
    <PublicShell>
      <main className="mx-auto max-w-xl px-4 py-16">
        <Card className="p-8">
          <h1 className="text-2xl font-black text-slate-950">Organisation invitation</h1>
          {invitation ? (
            <>
              <p className="my-5 text-sm leading-6 text-slate-600">You have been invited to join <strong>{invitation.organisationName}</strong> as {invitation.role}.</p>
              {user ? (
                <AcceptInvitationButton token={token} />
              ) : (
                <div className="space-y-3">
                  <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
                    Sign in or create your personal KingsHire account using the
                    email address that received this invitation. We will bring
                    you back here afterwards.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/sign-in${authQuery}`}
                      className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
                    >
                      Sign in to accept
                    </Link>
                    <Link
                      href={`/sign-up${authQuery}`}
                      className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Create an account
                    </Link>
                  </div>
                </div>
              )}
            </>
          ) : <p className="mt-5 text-sm text-red-600">This invitation is invalid, expired, or already accepted.</p>}
        </Card>
      </main>
    </PublicShell>
  );
}
