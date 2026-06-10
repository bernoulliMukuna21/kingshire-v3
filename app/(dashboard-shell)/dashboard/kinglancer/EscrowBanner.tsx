"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ChevronRight } from "lucide-react";
import Link from "next/link";
import ConfirmModal from "@/components/ConfirmModal";
import { AlertCircle } from "lucide-react";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

interface EscrowRowProps {
  jobId: string;
  jobTitle: string;
  heldAmount: number;
  deadline: string | null;
  isDone: boolean;
}

export default function EscrowRow({
  jobId,
  jobTitle,
  heldAmount,
  deadline,
  isDone,
}: EscrowRowProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { loading, error, setError, run } = useAsyncAction();

  const handleMarkDone = () => {
    setConfirmOpen(false);
    run(async () => {
      const res = await fetch(`/api/jobs/${jobId}/complete`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to submit. Please try again.");
      } else {
        router.refresh();
      }
    });
  };

  return (
    <>
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleMarkDone}
        title="Mark work as done?"
        message={
          <>
            This tells the client you&apos;ve completed &quot;
            <strong>{jobTitle}</strong>&quot;. They&apos;ll review and approve —
            releasing £{heldAmount.toFixed(2)} to you. You can&apos;t undo this.
          </>
        }
        confirmLabel="Yes, submit for review"
        variant="success"
        loading={loading}
      />

      {error && (
        <div className="mx-5 mt-2 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-red-400 text-xs">
          <AlertCircle size={12} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
        {/* Status dot */}
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${isDone ? "bg-yellow-400" : "bg-blue-500"}`}
        />

        {/* Job info */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/jobs/${jobId}`}
            className="font-semibold text-slate-950 hover:text-blue-600 transition-colors truncate block text-sm"
          >
            {jobTitle}
          </Link>
          {deadline && (
            <p className="text-slate-400 text-xs mt-0.5">
              Due{" "}
              {new Date(deadline).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })}
            </p>
          )}
        </div>

        {/* Amount */}
        <span className="text-slate-950 font-bold text-sm shrink-0">
          £{heldAmount.toFixed(2)}
        </span>

        {/* Action */}
        {isDone ? (
          <div className="shrink-0 flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg px-3 py-1.5 text-xs font-semibold">
            <CheckCircle size={12} />
            Submitted
          </div>
        ) : (
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={loading}
            className="shrink-0 flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Submitting..." : "Mark as Done"}
            {!loading && <ChevronRight size={12} />}
          </button>
        )}
      </div>
    </>
  );
}
