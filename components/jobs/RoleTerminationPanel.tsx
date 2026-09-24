"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RoleTerminationPanel({
  jobId,
  status,
  endRequestedBy,
  viewerId,
  kinglancerId,
}: {
  jobId: string;
  status: string;
  endRequestedBy: string | null;
  viewerId: string;
  kinglancerId: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (status !== "active") return null;

  const hasRequest = !!endRequestedBy;
  const proposerIsKinglancer = endRequestedBy === kinglancerId;
  const viewerIsKinglancer = viewerId === kinglancerId;
  const iAmProposer =
    hasRequest &&
    ((viewerIsKinglancer && proposerIsKinglancer) ||
      (!viewerIsKinglancer && !proposerIsKinglancer));

  async function act(action: "propose" | "confirm" | "decline") {
    setBusy(action);
    setError(null);
    const response = await fetch(`/api/jobs/${jobId}/role/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: reason || undefined }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setReason("");
    router.refresh();
  }

  if (!hasRequest) {
    return (
      <div className="mt-4 border-t border-slate-200 pt-3">
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason for ending this role early (optional)"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          rows={2}
        />
        <button
          type="button"
          onClick={() => act("propose")}
          disabled={busy !== null}
          className="mt-2 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-50"
        >
          {busy === "propose" ? "Requesting..." : "Request to end this role"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-slate-200 pt-3 text-sm">
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {iAmProposer ? (
        <p className="text-slate-600">
          Waiting for the other party to confirm ending this role.
        </p>
      ) : (
        <>
          <p className="text-slate-600">The other party asked to end this role early.</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => act("confirm")}
              disabled={busy !== null}
              className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {busy === "confirm" ? "Ending..." : "Confirm end"}
            </button>
            <button
              type="button"
              onClick={() => act("decline")}
              disabled={busy !== null}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-50"
            >
              {busy === "decline" ? "Declining..." : "Decline"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
