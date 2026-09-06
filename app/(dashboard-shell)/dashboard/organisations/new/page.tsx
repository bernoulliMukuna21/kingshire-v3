import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ShieldAlert } from "lucide-react";
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
        description="Set up a shared workspace for your Organisation."
      />
      <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
        <ShieldAlert className="mt-0.5 shrink-0 text-amber-600" size={22} />
        <div>
          <p className="font-bold">You will become the Organisation Owner</p>
          <p className="mt-1 text-sm leading-6 text-amber-900/80">
            The Owner has full control over the workspace, members, deletion
            and future billing. You can invite your team after setup and
            transfer ownership later.
          </p>
        </div>
      </div>
      <Card className="p-6"><OrganisationForm /></Card>
    </div>
  );
}
