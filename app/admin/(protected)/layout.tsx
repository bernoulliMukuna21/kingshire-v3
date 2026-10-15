import { Suspense, type ReactNode } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/lib/admin-dashboard";

import { getAdminQueues } from "@/lib/admin/queues";

async function ActionBadge() {
  const queues = await getAdminQueues();
  return <>{queues.unavailable.length ? "—" : queues.actionCount}</>;
}

export default async function AdminProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = await requireAdminPage();

  return (
    <AdminShell
      actionBadge={
        <Suspense fallback={<span>—</span>}>
          <ActionBadge />
        </Suspense>
      }
      userEmail={user.email}
    >
      {children}
    </AdminShell>
  );
}
