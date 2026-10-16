"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
export default function AdminEngagementDisputeActions({
  paymentId,
  source,
}: {
  paymentId: string;
  source: "role" | "placement";
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"release" | "refund" | null>(null);
  const { loading, error, run } = useAsyncAction();
  function confirm() {
    if (!pending) return;
    run(async () => {
      const response = await fetch(
        `/api/admin/${source}-payments/${paymentId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: pending }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error ?? "Could not resolve payment dispute");
      setPending(null);
      router.refresh();
    });
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setPending("release")}
          disabled={loading}
          className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50"
        >
          Release to worker
        </button>
        <button
          onClick={() => setPending("refund")}
          disabled={loading}
          className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 disabled:opacity-50"
        >
          Refund organisation
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <ConfirmModal
        isOpen={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={confirm}
        loading={loading}
        title={
          pending === "refund"
            ? "Refund the organisation?"
            : "Release payment to the worker?"
        }
        message={
          pending === "refund"
            ? "This resolves the disputed period by returning the payment to the organisation through the existing refund process."
            : "This resolves the disputed period and starts the worker payout through the existing settlement process."
        }
        confirmLabel={
          pending === "refund" ? "Confirm refund" : "Confirm release"
        }
      />
    </div>
  );
}
