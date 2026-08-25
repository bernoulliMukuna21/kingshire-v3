"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Rocket, Trash2 } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

type Action = "publish" | "close" | "cancel" | "delete";

export default function PlacementActions({
  organisationId,
  placementId,
  status,
  canDelete = false,
}: {
  organisationId: string;
  placementId: string;
  status: string;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
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

  async function deletePlacement() {
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(
        `/api/organisations/${organisationId}/placements/${placementId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not delete this placement.");
        return;
      }
      setConfirmingDelete(false);
      router.push(`/dashboard/organisations/${organisationId}/placements`);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const btn =
    "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-50";

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3">
      {error && <span className="text-xs text-red-600">{error}</span>}
      {status === "draft" && (
        <button
          onClick={() => run("publish")}
          disabled={busy !== null}
          className={`${btn} bg-blue-600 text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700`}
        >
          <Rocket size={15} />
          {busy === "publish" ? "Publishing…" : "Publish"}
        </button>
      )}
      {status !== "cancelled" && status !== "closed" && (
        <button
          onClick={() => setConfirmingCancel(true)}
          disabled={busy !== null}
          className={`${btn} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}
        >
          <Ban size={15} />
          End placement
        </button>
      )}
      {canDelete && (status === "cancelled" || status === "closed") && (
        <button
          onClick={() => setConfirmingDelete(true)}
          disabled={busy !== null}
          className={`${btn} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}
        >
          <Trash2 size={15} />
          Delete placement
        </button>
      )}
      <ConfirmModal
        isOpen={confirmingCancel}
        onClose={() => setConfirmingCancel(false)}
        onConfirm={async () => {
          await run("cancel");
          setConfirmingCancel(false);
        }}
        title="End this placement?"
        message={
          <>
            <p className="mb-2">Ending this placement will:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Remove it from{" "}
                <span className="font-bold text-slate-900">public search</span>{" "}
                — no new applications come in.
              </li>
              <li>
                <span className="font-bold text-slate-900">Withdraw </span> any
                offers you&apos;ve sent that haven&apos;t been accepted yet.
              </li>
              <li>
                Keep anyone{" "}
                <span className="font-bold text-slate-900">already active</span>{" "}
                going — you still complete them individually.
              </li>
            </ul>
            <p className="mt-2.5 font-bold text-red-600">
              This can&apos;t be undone — but you can repost it later.
            </p>
          </>
        }
        confirmLabel="End placement"
        loading={busy === "cancel"}
        variant="danger"
        error={error ?? undefined}
      />
      <ConfirmModal
        isOpen={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={deletePlacement}
        title="Delete this placement?"
        message="This permanently removes the placement. This can't be undone."
        confirmLabel="Delete placement"
        loading={busy === "delete"}
        variant="danger"
        error={error ?? undefined}
      />
    </div>
  );
}
