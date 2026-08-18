"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";

export default function MemberActions({
  organisationId,
  userId,
  role,
  actorRole,
}: {
  organisationId: string;
  userId: string;
  role: "owner" | "admin" | "member";
  actorRole: "owner" | "admin" | "member";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pendingRole, setPendingRole] = useState<"member" | "admin" | null>(
    null,
  );
  if (role === "owner" || actorRole === "member" || (actorRole === "admin" && role === "admin")) {
    return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold capitalize">{role}</span>;
  }
  async function applyRole(nextRole: "member" | "admin") {
    setBusy(true);
    await fetch(`/api/organisations/${organisationId}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: nextRole }),
    });
    setBusy(false);
    setPendingRole(null);
    router.refresh();
  }
  async function remove() {
    if (!window.confirm("Remove this member from the Organisation?")) return;
    setBusy(true);
    await fetch(`/api/organisations/${organisationId}/members/${userId}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="flex items-center gap-2">
      <select
        value={role}
        disabled={busy}
        onChange={(event) => {
          const next = event.target.value as "member" | "admin";
          if (next !== role) setPendingRole(next);
        }}
        className="rounded-xl border border-slate-200 px-2 py-1 text-xs font-bold"
      >
        <option value="member">Member</option>
        {actorRole === "owner" && <option value="admin">Admin</option>}
      </select>
      <button onClick={remove} disabled={busy} className="text-xs font-bold text-red-600 hover:text-red-700">
        Remove
      </button>

      <ConfirmModal
        isOpen={pendingRole !== null}
        onClose={() => setPendingRole(null)}
        onConfirm={() => pendingRole && applyRole(pendingRole)}
        loading={busy}
        variant="primary"
        confirmLabel={pendingRole === "admin" ? "Make Admin" : "Make Member"}
        title={
          pendingRole === "admin"
            ? "Make this member an Admin?"
            : "Change this Admin to a Member?"
        }
        message={
          pendingRole === "admin"
            ? "Admins can manage the workspace, team, jobs and applicants. You can change this back at any time."
            : "They will lose Admin permissions and become a regular Member."
        }
      />
    </div>
  );
}
