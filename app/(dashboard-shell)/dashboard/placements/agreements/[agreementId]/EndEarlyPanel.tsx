"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EndEarlyPanel({
  agreementId,
  hasRequest,
  iAmProposer,
  endReason,
  proposerLabel,
}: {
  agreementId: string;
  hasRequest: boolean;
  iAmProposer: boolean;
  endReason: string | null;
  proposerLabel: string;
}) {
  const router = useRouter();
  const [proposing, setProposing] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<
    "propose" | "confirm" | "decline" | "escalate" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const wordCount = reason.trim().split(/\s+/).filter(Boolean).length;

  async function send(
    action: "propose" | "confirm" | "decline" | "escalate",
    withReason = false,
  ) {
    if (action === "propose" && wordCount < 20) {
      setError("Please give a reason for ending early (at least 20 words).");
      return;
    }
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/placements/agreements/${agreementId}/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withReason ? { action, reason } : { action }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      setBusy(null);
      return;
    }
    setProposing(false);
    router.refresh();
  }

  const err = error && <p className="text-xs text-red-600">{error}</p>;

  // The other party is deciding on a pending request.
  if (hasRequest && !iAmProposer) {
    return (
      <section>
        <h2 className="mb-3 text-lg font-black text-slate-950">
          End placement early
        </h2>
        <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5">
          <p className="text-sm font-bold text-slate-900">
            {proposerLabel} has asked to end this placement early.
          </p>
          {endReason && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
              “{endReason}”
            </p>
          )}
          <p className="mt-2 text-sm text-slate-600">
            If you agree, the placement ends now, future charges stop, and any
            month already paid is reviewed by KingsHire. No verified record is
            issued for an early end.
          </p>
          {err}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => send("decline")}
              disabled={busy !== null}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => send("confirm")}
              disabled={busy !== null}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy === "confirm" ? "Ending…" : "Confirm & end"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => send("escalate")}
            disabled={busy !== null}
            className="mt-3 text-xs font-bold text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline disabled:opacity-50"
          >
            {busy === "escalate"
              ? "Contacting KingsHire…"
              : "Can't agree? Ask KingsHire to decide"}
          </button>
        </div>
      </section>
    );
  }

  // We proposed and are waiting for the other party.
  if (hasRequest && iAmProposer) {
    return (
      <section>
        <h2 className="mb-3 text-lg font-black text-slate-950">
          End placement early
        </h2>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm text-slate-600">
            You&apos;ve asked to end this placement early. It ends once the
            other party confirms.
          </p>
          {err}
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => send("decline")}
              disabled={busy !== null}
              className="text-xs font-bold text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline disabled:opacity-50"
            >
              Withdraw request
            </button>
            <button
              type="button"
              onClick={() => send("escalate")}
              disabled={busy !== null}
              className="text-xs font-bold text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline disabled:opacity-50"
            >
              {busy === "escalate"
                ? "Contacting KingsHire…"
                : "No response? Ask KingsHire to decide"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  // No request yet — offer to propose ending early.
  return (
    <section>
      <h2 className="mb-3 text-lg font-black text-slate-950">
        End placement early
      </h2>
      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        {proposing ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Ending early stops future charges and issues no verified record.
              The other party must confirm before it ends.
            </p>
            {err}
            <textarea
              className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (required, at least 20 words)"
              maxLength={2000}
            />
            <p
              className={`text-xs ${
                wordCount >= 20 ? "text-slate-400" : "text-slate-500"
              }`}
            >
              {wordCount}/20 words
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setProposing(false)}
                disabled={busy !== null}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => send("propose", true)}
                disabled={busy !== null}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy === "propose" ? "Sending…" : "Request to end"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Not working out? You and the other party can agree to end this
              placement early.
            </p>
            <button
              type="button"
              onClick={() => setProposing(true)}
              className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
            >
              End placement early
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
