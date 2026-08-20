"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";

type Action = "publish" | "close" | "cancel";

export default function PlacementActions({
  organisationId,
  placementId,
  status,
}: {
  organisationId: string;
  placementId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(
        `/api/organisations/${organisationId}/placements/${placementId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const btn =
    "rounded-xl px-3 py-1.5 text-xs font-bold transition disabled:opacity-50";

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      {status === "draft" && (
        <button
          onClick={() => run("publish")}
          disabled={busy !== null}
          className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}
        >
          {busy === "publish" ? "Publishing…" : "Publish"}
        </button>
      )}
      {(status === "open" || status === "pending_review") && (
        <button
          onClick={() => run("close")}
          disabled={busy !== null}
          className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200`}
        >
          {busy === "close" ? "Closing…" : "Close"}
        </button>
      )}
      {status !== "cancelled" && status !== "closed" && (
        <button
          onClick={() => setConfirmingCancel(true)}
          disabled={busy !== null}
          className={`${btn} text-red-600 hover:bg-red-50`}
        >
          Cancel
        </button>
      )}
      <ConfirmModal
        isOpen={confirmingCancel}
        onClose={() => setConfirmingCancel(false)}
        onConfirm={async () => {
          await run("cancel");
          setConfirmingCancel(false);
        }}
        title="Cancel this placement?"
        message="This removes it from public view and closes it to new applicants. This can't be undone."
        confirmLabel="Cancel placement"
        loading={busy === "cancel"}
        variant="danger"
        error={error ?? undefined}
      />
    </div>
  );
}
