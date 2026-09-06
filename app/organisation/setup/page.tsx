import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OrganisationSetupWizard from "./OrganisationSetupWizard";
import ClientAccountStep from "./ClientAccountStep";

export default async function OrganisationSetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/sign-up?intent=organisation&role=client&next=${encodeURIComponent("/organisation/setup")}`,
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.role) {
    return <ClientAccountStep />;
  }

  return (
    <Suspense>
      <OrganisationSetupWizard />
    </Suspense>
  );
}
