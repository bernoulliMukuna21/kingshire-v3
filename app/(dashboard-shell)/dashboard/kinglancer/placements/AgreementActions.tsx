"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AgreementActions({
  agreementId,
}: {
  agreementId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "accept" | "decline") {
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/placements/agreements/${agreementId}`, {
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
        onClick={() => run("accept")}
        disabled={busy !== null}
        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy === "accept" ? "Accepting…" : "Accept"}
      </button>
      <button
        onClick={() => run("decline")}
        disabled={busy !== null}
        className="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
      >
        Decline
      </button>
    </div>
  );
}
