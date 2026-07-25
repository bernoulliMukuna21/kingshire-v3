import DashboardShell from "@/components/DashboardShell";
import { getDashboardContext } from "@/lib/dashboard-context";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, organisations } = await getDashboardContext();

  return (
    <DashboardShell profile={profile} organisations={organisations}>
      {children}
    </DashboardShell>
  );
}
