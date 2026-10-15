import type { ReactNode } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/lib/admin-dashboard";

import { getAdminQueues } from "@/lib/admin/queues";

export default async function AdminProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = await requireAdminPage();

  const queues = await getAdminQueues();
  return (
    <AdminShell
      actionCount={queues.unavailable.length ? null : queues.actionCount}
      userEmail={user.email}
    >
      {children}
    </AdminShell>
  );
}
