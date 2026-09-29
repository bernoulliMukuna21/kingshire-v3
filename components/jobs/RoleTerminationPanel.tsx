"use client";

import ConfirmModal from "@/components/ConfirmModal";
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
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const viewerIsKinglancer = viewerId === kinglancerId;

  // pending_acceptance already has an accept/decline UI for the kinglancer —
  // only the org needs a way to retract before the candidate responds.
  if (status === "pending_acceptance" && viewerIsKinglancer) return null;
  if (
    status !== "active" &&
    status !== "pending_acceptance" &&
    status !== "pending_funding"
  )
    return null;

  const hasRequest = !!endRequestedBy;
  const proposerIsKinglancer = endRequestedBy === kinglancerId;
  const iAmProposer =
    hasRequest &&
    ((viewerIsKinglancer && proposerIsKinglancer) ||
      (!viewerIsKinglancer && !proposerIsKinglancer));

  async function withdraw() {
    setBusy("withdraw");
    setError(null);
    const response = await fetch(`/api/jobs/${jobId}/role/withdraw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason || undefined }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(null);
    if (!response.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setReason("");
    setWithdrawOpen(false);
    router.refresh();
  }

  if (status !== "active") {
    return (
      <div>
        <details className="relative inline-block">
          <summary className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">Offer actions</summary>
          <button type="button" onClick={(event) => { setWithdrawOpen(true); event.currentTarget.closest("details")?.removeAttribute("open"); }} className="mt-2 block rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-red-700">Withdraw offer</button>
        </details>
        <ConfirmModal
          isOpen={withdrawOpen}
          onClose={() => { if (!busy) { setWithdrawOpen(false); setError(null); } }}
          onConfirm={withdraw}
          title="Withdraw this offer?"
          confirmLabel="Withdraw offer"
          variant="danger"
          loading={busy === "withdraw"}
          error={error ?? undefined}
          message={<div className="space-y-4">
            <p>The Kinglancer will no longer be able to start this role under this offer. Withdrawal is available only while funding has not been processed.</p>
            <label className="block text-sm font-medium">Reason (optional)
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" rows={3} />
            </label>
          </div>}
        />
      </div>
    );
  }

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
    setWithdrawOpen(false);
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
          <p className="text-slate-600">
            The other party asked to end this role early.
          </p>
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
