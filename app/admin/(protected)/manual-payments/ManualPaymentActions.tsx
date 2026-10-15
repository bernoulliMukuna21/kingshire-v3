"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

export function ConfirmFundsButton({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { loading, error, run } = useAsyncAction();
  function confirm() {
    run(async () => {
      const res = await fetch(
        `/api/admin/manual-payments/${attemptId}/confirm`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not confirm receipt");
      }
      setOpen(false);
      router.refresh();
    });
  }
  return (
    <div>
      <button
        onClick={() => setOpen(true)}
        disabled={loading}
        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
      >
        Verify bank receipt
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <ConfirmModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
        loading={loading}
        title="Confirm money arrived in the bank?"
        message="Check the actual bank transaction and amount. A client marking money as sent does not confirm receipt. This confirms funding and starts the job."
        confirmLabel="I checked the bank receipt"
      />
    </div>
  );
}
export function RecordPayoutButton({
  jobId,
  defaultReference,
}: {
  jobId: string;
  defaultReference?: string;
}) {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [open, setOpen] = useState(false);
  const { loading, error, run } = useAsyncAction();
  function record() {
    run(async () => {
      const res = await fetch(`/api/admin/manual-payments/${jobId}/payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not record payout");
      }
      setOpen(false);
      router.refresh();
    });
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input
          aria-label="Outward payment reference"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="Outward bank payment reference"
          className="w-56 rounded-lg border border-slate-200 px-3 py-2 text-xs"
        />
        <button
          disabled={loading || !reference.trim()}
          onClick={() => setOpen(true)}
          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          Record external payout
        </button>
      </div>
      {defaultReference && (
        <p className="text-xs text-slate-400">
          Job reference: {defaultReference}. Enter the reference of the money
          you sent above.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <ConfirmModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={record}
        loading={loading}
        title="Record a completed external payout?"
        message={`Confirm the worker has already received the payment. Reference: ${reference}. This records the payout; it does not send money.`}
        confirmLabel="Record completed payout"
      />
    </div>
  );
}
