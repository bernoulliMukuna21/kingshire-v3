"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminPlacementActions({
  placementId,
}: {
  placementId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "approve" | "reject") {
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/admin/placements/${placementId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      setBusy(null);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        onClick={() => run("approve")}
        disabled={busy !== null}
        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy === "approve" ? "…" : "Approve"}
      </button>
      <button
        onClick={() => run("reject")}
        disabled={busy !== null}
        className="rounded-xl px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}
