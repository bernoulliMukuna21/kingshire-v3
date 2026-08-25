"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PaymentReviewButtons({
  agreementId,
  paymentId,
}: {
  agreementId: string;
  paymentId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "dispute" | null>(null);
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function send(action: "approve" | "dispute") {
    setBusy(action);
    setError(null);
    const res = await fetch(
      `/api/placements/agreements/${agreementId}/payments/${paymentId}/action`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "dispute" ? { action, reason } : { action },
        ),
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      setBusy(null);
      return;
    }
    setDisputing(false);
    router.refresh();
  }

  const btn =
    "rounded-xl px-3 py-1.5 text-xs font-bold transition disabled:opacity-50";

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      {error && <span className="text-[11px] text-red-600">{error}</span>}
      {disputing ? (
        <div className="w-56 space-y-2">
          <textarea
            className="w-full resize-none rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What's the issue this month?"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDisputing(false)}
              disabled={busy !== null}
              className={`${btn} text-slate-500 hover:bg-slate-100`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => send("dispute")}
              disabled={busy !== null}
              className={`${btn} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}
            >
              {busy === "dispute" ? "Sending…" : "Raise dispute"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDisputing(true)}
            disabled={busy !== null}
            className={`${btn} text-red-600 hover:bg-red-50`}
          >
            Dispute
          </button>
          <button
            type="button"
            onClick={() => send("approve")}
            disabled={busy !== null}
            className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}
          >
            {busy === "approve" ? "Releasing…" : "Approve & release"}
          </button>
        </div>
      )}
    </div>
  );
}
