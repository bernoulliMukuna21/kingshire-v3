"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SettlementLedger } from "@/lib/settlement/dispatch";

export default function RecoveryActions({
  id,
  ledger,
  attemptId,
  canReset,
  canRetry,
}: {
  id: string;
  ledger?: SettlementLedger;
  attemptId?: string;
  canReset?: boolean;
  canRetry?: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [externalId, setExternalId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(action: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/settlement/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          id,
          ledger,
          attemptId,
          reason,
          ...(externalId.trim() ? { externalId: externalId.trim() } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recovery failed");
    } finally {
      setBusy(false);
    }
  }
  const disabled = busy || reason.trim().length < 10;
  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs text-slate-500">
        For support staff: check Stripe first. Sending a saved request or
        restarting payments can move money. Allowing another attempt clears the
        stopped attempt; it does not send money immediately.
      </p>
      <label className="block text-sm">
        What did you check?
        <input
          className="mt-1 block w-full rounded border p-2"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          placeholder="Explain the checks you completed (at least 10 characters)"
        />
      </label>
      {ledger && (
        <label className="block text-sm">
          Existing Stripe transfer or refund ID
          <input
            className="mt-1 block w-full rounded border p-2"
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
            placeholder="tr_… or re_…"
          />
        </label>
      )}
      <div className="flex flex-wrap gap-3">
        {!ledger && (
          <button
            disabled={disabled}
            onClick={() => submit("resume")}
            className="rounded border px-3 py-2 disabled:opacity-40"
          >
            Restart ongoing payments
          </button>
        )}
        {canReset && (
          <button
            disabled={disabled}
            onClick={() => submit("reset")}
            className="rounded border px-3 py-2 disabled:opacity-40"
          >
            Allow this payment to be tried again
          </button>
        )}
        {canRetry && (
          <button
            disabled={disabled}
            onClick={() => submit("retry")}
            className="rounded border px-3 py-2 disabled:opacity-40"
          >
            Send the saved payment request again
          </button>
        )}
        {ledger && (
          <button
            disabled={
              disabled || !/^(tr|re)_[A-Za-z0-9]+$/.test(externalId.trim())
            }
            onClick={() => submit("reconcile")}
            className="rounded border px-3 py-2 disabled:opacity-40"
          >
            Check Stripe and save the result
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
