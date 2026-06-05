"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, RefreshCw } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

type Action = "release" | "refund" | null;

export default function DisputeActions({
  disputeId,
  jobBudget,
}: {
  disputeId: string;
  jobBudget: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Action>(null);
  const { loading, error, run } = useAsyncAction();

  const handleConfirm = () => {
    if (!pending) return;
    run(async () => {
      const res = await fetch(`/api/admin/disputes/${disputeId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: pending }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setPending(null);
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPending("release")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 ring-1 ring-green-200 transition-colors hover:bg-green-100"
        >
          <CheckCircle size={13} />
          Award Kinglancer
        </button>
        <button
          type="button"
          onClick={() => setPending("refund")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 ring-1 ring-orange-200 transition-colors hover:bg-orange-100"
        >
          <RefreshCw size={13} />
          Refund Client
        </button>
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      <ConfirmModal
        isOpen={pending === "release"}
        onClose={() => setPending(null)}
        onConfirm={handleConfirm}
        loading={loading}
        title="Award to Kinglancer?"
        message={`This will release the £${jobBudget.toFixed(2)} escrow to the Kinglancer. This cannot be undone.`}
        confirmLabel="Release payment"
      />
      <ConfirmModal
        isOpen={pending === "refund"}
        onClose={() => setPending(null)}
        onConfirm={handleConfirm}
        loading={loading}
        title="Refund to Client?"
        message={`This will issue a full refund of £${(jobBudget * 1.05).toFixed(2)} to the client's original payment method. This cannot be undone.`}
        confirmLabel="Issue refund"
      />
    </>
  );
}
