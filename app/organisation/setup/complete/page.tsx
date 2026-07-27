import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OrganisationSetupShell from "@/components/organisations/OrganisationSetupShell";
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
    <OrganisationSetupShell currentStep="payment">
      <main className="flex min-h-[60vh] items-center">
        <OrganisationConfirmation sessionId={sessionId} />
      </main>
    </OrganisationSetupShell>
  );
}
