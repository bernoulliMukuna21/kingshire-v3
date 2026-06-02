import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PostJobForm from "./PostJobForm";
import DashboardShell from "@/components/DashboardShell";
import { getNavItems } from "@/lib/dashboard-nav";

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
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-gray-900">Post a Job</h1>
          <p className="text-gray-500 text-sm mt-1">
            Describe what you need and kinglancers from your community will
            apply.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <PostJobForm />
        </div>
      </div>
    </DashboardShell>
  );
}
