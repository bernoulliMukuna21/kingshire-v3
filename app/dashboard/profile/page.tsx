import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./ProfileForm";
import DashboardShell from "@/components/DashboardShell";
import { getNavItems } from "@/lib/dashboard-nav";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/sign-in");

  const isKinglancer = profile.role === "kinglancer";
  const navItems = getNavItems(profile.role, "/dashboard/profile");

  return (
    <DashboardShell profile={profile} navItems={navItems}>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-gray-900">My Profile</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isKinglancer
              ? "Update your personal details and public Kinglancer profile."
              : "Update your personal details."}
          </p>
        </div>
        <ProfileForm profile={profile} />
      </div>
    </DashboardShell>
  );
}
