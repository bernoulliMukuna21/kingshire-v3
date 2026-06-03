import type { ReactNode } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/lib/admin-dashboard";

export default async function AdminProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = await requireAdminPage();

  return <AdminShell userEmail={user.email}>{children}</AdminShell>;
}
