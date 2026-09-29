"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, AlertCircle, Flag } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

export function ClientApproveActions({
  jobId,
  showApprove,
}: {
  jobId: string;
  showApprove: boolean;
}) {
  const router = useRouter();
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState("");
  const approveAction = useAsyncAction();
  const disputeAction = useAsyncAction();
  const error = approveAction.error ?? disputeAction.error;

  const handleApprove = () => {
    setApproveConfirmOpen(false);
    approveAction.run(async () => {
      const res = await fetch(`/api/jobs/${jobId}/approve`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        approveAction.setError(data.error ?? "Failed to release payment.");
        return;
      }
      router.refresh();
    });
  };

  const handleDispute = (e: React.FormEvent) => {
    e.preventDefault();
    disputeAction.run(async () => {
      const res = await fetch(`/api/jobs/${jobId}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        disputeAction.setError(data.error ?? "Failed to raise dispute.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <>
      <ConfirmModal
        isOpen={approveConfirmOpen}
        onClose={() => setApproveConfirmOpen(false)}
        onConfirm={handleApprove}
        title="Release payment?"
        message="This confirms the work is complete and immediately releases the escrowed payment to the Kinglancer. This cannot be undone."
        confirmLabel="Yes, release payment"
        variant="success"
        loading={approveAction.loading}
      />
      <div className="space-y-3">
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {showApprove && (
          <button
            onClick={() => setApproveConfirmOpen(true)}
            disabled={approveAction.loading}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {approveAction.loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Releasing payment...
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                Approve &amp; release payment
              </>
            )}
          </button>
        )}

        {!disputeOpen ? (
          <button
            onClick={() => setDisputeOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-all"
          >
            <Flag size={15} />
            Raise a dispute
          </button>
        ) : (
          <form onSubmit={handleDispute} className="space-y-3">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Briefly describe the issue..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm resize-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDisputeOpen(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={disputeAction.loading}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {disputeAction.loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  "Submit dispute"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
