import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserOrganisationSummaries } from "@/infrastructure/supabase/queries/organisation-queries";
import PostJobFormLoader from "./PostJobFormLoader";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

export default async function PostJobPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/onboarding");
  if (profile.role === "admin") redirect("/admin");
  if (profile.role === "kinglancer") redirect("/dashboard/kinglancer");
  if (profile.role !== "client") redirect("/onboarding");

  const organisations = (await getUserOrganisationSummaries(user.id)).map(
    (o) => ({ id: o.id, name: o.name }),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow="New job"
        title="Post a Job"
        description="Describe what you need and Kinglancers from your community will apply."
      />

      <Card className="p-6">
        <PostJobFormLoader organisations={organisations} />
      </Card>
    </div>
  );
}
