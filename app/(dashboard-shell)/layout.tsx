import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
  if (profile.role === "admin") redirect("/admin");
  if (!profile.role) redirect("/onboarding");

  // For kinglancers, fetch active contracts to show in the sidebar
  let activeContracts: { id: string; title: string; status: string }[] = [];
  if (profile.role === "kinglancer") {
    const { data } = await supabase
      .from("jobs")
      .select("id, title, status")
      .eq("kinglancer_id", user.id)
      .in("status", ["in_progress", "completed"])
      .order("created_at", { ascending: false })
      .limit(5);
    activeContracts = (data ?? []) as typeof activeContracts;
  }

  return (
    <DashboardShell profile={profile} activeContracts={activeContracts}>
      {children}
    </DashboardShell>
  );
}
