"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";

export default function AdminPlacementActions({
  placementId,
}: {
  placementId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  async function run(action: "approve" | "reject") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/placements/${placementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "reject" ? { action, reason } : { action },
        ),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setConfirming(false);
      setRejecting(false);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (rejecting) {
    return (
      <div className="w-64 shrink-0 space-y-2">
        {error && <p className="text-xs text-red-600">{error}</p>}
        <textarea
          className="w-full resize-none rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for rejection (optional) — shared with the organisation"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setRejecting(false)}
            disabled={busy !== null}
            className="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => run("reject")}
            disabled={busy !== null}
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            {busy === "reject" ? "Rejecting…" : "Reject placement"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        onClick={() => setConfirming(true)}
        disabled={busy !== null}
        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy === "approve" ? "…" : "Approve"}
      </button>
      <button
        onClick={() => setRejecting(true)}
        disabled={busy !== null}
        className="rounded-xl px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        Reject
      </button>

      <ConfirmModal
        isOpen={confirming}
        onClose={() => (busy ? undefined : setConfirming(false))}
        onConfirm={() => run("approve")}
        title="Approve this placement?"
        message="It goes live and becomes visible to Kinglancers to apply. You can't undo this from here."
        confirmLabel="Approve & publish"
        variant="success"
        loading={busy === "approve"}
      />
    </div>
  );
}
