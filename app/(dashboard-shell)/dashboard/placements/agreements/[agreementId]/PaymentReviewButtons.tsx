"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";

export default function PaymentReviewButtons({
  agreementId,
  paymentId,
  amount,
}: {
  agreementId: string;
  paymentId: string;
  amount?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "dispute" | null>(null);
  const [disputing, setDisputing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function send(action: "approve" | "dispute") {
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setConfirming(false);
      setDisputing(false);
      // Approve can succeed without moving money yet (Kinglancer not onboarded);
      // surface that instead of silently doing nothing.
      if (action === "approve" && data.released === false && data.message) {
        setNotice(data.message);
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
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      {error && <span className="text-[11px] text-red-600">{error}</span>}
      {notice && (
        <span className="max-w-xs text-right text-[11px] text-amber-700">
          {notice}
        </span>
      )}
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
            onClick={() => setConfirming(true)}
            disabled={busy !== null}
            className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`}
          >
            {busy === "approve" ? "Releasing…" : "Approve & release"}
          </button>
        </div>
      )}

      <ConfirmModal
        isOpen={confirming}
        onClose={() => (busy ? undefined : setConfirming(false))}
        onConfirm={() => send("approve")}
        title="Release this month now?"
        message={
          <>
            This pays the Kinglancer
            {typeof amount === "number" ? ` £${amount.toFixed(2)}` : ""} for this
            month <strong>now</strong>, ahead of the month-end release. Only do
            this once you&apos;re happy with their work — it can&apos;t be undone.
          </>
        }
        confirmLabel="Release payment"
        variant="success"
        loading={busy === "approve"}
      />
    </div>
  );
}
