import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import OrganisationForm from "./OrganisationForm";

export default async function NewOrganisationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Organisation workspace"
        title="Create an Organisation"
        description="You will become the Owner and can invite your team after setup."
      />
      <Card className="p-6"><OrganisationForm /></Card>
    </div>
  );
}
