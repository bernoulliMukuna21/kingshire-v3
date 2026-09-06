"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminDisputeActions({
  paymentId,
}: {
  paymentId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"release" | "refund" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(action: "release" | "refund") {
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/admin/placement-payments/${paymentId}`, {
      method: "POST",
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

  const btn =
    "rounded-xl px-3 py-1.5 text-xs font-bold transition disabled:opacity-50";

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      {error && <span className="text-[11px] text-red-600">{error}</span>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => resolve("refund")}
          disabled={busy !== null}
          className={`${btn} border border-slate-200 text-slate-700 hover:bg-slate-50`}
        >
          {busy === "refund" ? "Refunding…" : "Refund org"}
        </button>
        <button
          type="button"
          onClick={() => resolve("release")}
          disabled={busy !== null}
          className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}
        >
          {busy === "release" ? "Releasing…" : "Release to Kinglancer"}
        </button>
      </div>
    </div>
  );
}
