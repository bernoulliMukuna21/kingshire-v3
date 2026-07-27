import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PublicShell from "@/components/ui/PublicShell";
import OrganisationSetupWizard from "./OrganisationSetupWizard";

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
    redirect(
      `/onboarding?intent=organisation&role=client&next=${encodeURIComponent("/organisation/setup")}`,
    );
  }

  return (
    <PublicShell navbarVariant="solid">
      <main className="min-h-screen bg-slate-50 px-4 pb-20 pt-28 sm:px-6">
        <Suspense>
          <OrganisationSetupWizard />
        </Suspense>
      </main>
    </PublicShell>
  );
}
