import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PublicShell from "@/components/ui/PublicShell";
import OrganisationConfirmation from "./OrganisationConfirmation";

export default async function OrganisationSetupCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/organisation/setup");

  const { session_id: sessionId } = await searchParams;
  if (!sessionId?.startsWith("cs_")) redirect("/organisation/setup");

  return (
    <PublicShell navbarVariant="solid">
      <main className="flex min-h-screen items-center bg-slate-50 px-4 py-28 sm:px-6">
        <OrganisationConfirmation sessionId={sessionId} />
      </main>
    </PublicShell>
  );
}
