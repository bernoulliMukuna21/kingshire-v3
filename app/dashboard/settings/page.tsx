import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SwitchRoleButton from "@/app/dashboard/profile/SwitchRoleButton";
import DashboardShell from "@/components/DashboardShell";
import { getNavItems } from "@/lib/dashboard-nav";

export default async function SettingsPage() {
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
  if (!profile) redirect("/sign-in");

  const isKinglancer = profile.role === "kinglancer";
  const navItems = getNavItems(profile.role, "/dashboard/settings");
  const deletionRequestHref = `mailto:kingshirecompany@gmail.com?subject=${encodeURIComponent(
    "KingsHire account deletion request",
  )}&body=${encodeURIComponent(
    `Please delete my KingsHire account.\n\nUser ID: ${user.id}\nEmail: ${user.email ?? ""}\n\nI understand active jobs, payments, disputes, and legally required transaction records may need to be reviewed before deletion is completed.`,
  )}`;

  return (
    <DashboardShell profile={profile} navItems={navItems}>
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-gray-900">Settings</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage your account preferences.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-base font-bold text-gray-900 mb-1">
            Switch Role
          </h2>
          <p className="text-gray-500 text-sm mb-5">
            You are currently a{" "}
            <span className="font-semibold text-gray-800">
              {isKinglancer ? "Kinglancer" : "Client"}
            </span>
            . Switching will move you to the other dashboard.
          </p>
          <SwitchRoleButton currentRole={profile.role} />
        </div>

        <div className="bg-white rounded-2xl border border-red-100 p-6">
          <h2 className="text-base font-bold text-gray-900 mb-1">
            Account Deletion
          </h2>
          <p className="text-gray-500 text-sm mb-5">
            For the MVP, deletion requests are reviewed manually so payments,
            jobs, disputes, and required transaction records are handled
            correctly.
          </p>
          <a
            href={deletionRequestHref}
            className="inline-flex items-center justify-center rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors"
          >
            Request account deletion
          </a>
        </div>
      </div>
    </DashboardShell>
  );
}
