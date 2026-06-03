import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PostJobForm from "./PostJobForm";
import DashboardShell from "@/components/DashboardShell";
import { getNavItems } from "@/lib/dashboard-nav";
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
    .select("full_name, role, avatar_url")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "client") redirect("/dashboard/kinglancer");

  const navItems = getNavItems("client", "/jobs/post");

  return (
    <DashboardShell profile={profile} navItems={navItems}>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <PageHeader
          eyebrow="New job"
          title="Post a Job"
          description="Describe what you need and Kinglancers from your community will apply."
        />

        <Card className="p-6">
          <PostJobForm />
        </Card>
      </div>
    </DashboardShell>
  );
}
