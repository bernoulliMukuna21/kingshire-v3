"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

type Props = {
  jobId: string;
  /** The current job status — drives the confirmation copy. */
  status: "open" | "in_progress";
  /** True if the open job already has applicants (affects modal copy). */
  hasApplications?: boolean;
  /** Held payment rail (in_progress) — bank_transfer refunds go via support. */
  paymentMethod?: "card" | "bank_transfer" | null;
};

export default function CancelJobButton({
  jobId,
  status,
  hasApplications = false,
  paymentMethod = null,
}: Props) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { loading, error, run } = useAsyncAction();

  const isInProgress = status === "in_progress";
  // Bank-transfer escrow is held by us, so refunds are arranged by support.
  const manualInProgress = isInProgress && paymentMethod === "bank_transfer";

  const title = isInProgress ? "Cancel this job?" : "Cancel this job posting?";

  const message = manualInProgress
    ? "This job was paid by bank transfer, so refunds are handled by our team. To cancel it and arrange your refund, please contact support and we'll sort it out."
    : isInProgress
      ? "This job is currently in progress. You may cancel within the 2-hour grace period for a full refund. After that window you will need to raise a dispute instead. The Kinglancer will be notified immediately."
      : hasApplications
        ? "Cancelling will close this job and reject all pending applications. This action cannot be undone."
        : "This will permanently cancel your job posting. This action cannot be undone.";

  const confirmLabel = manualInProgress
    ? "Contact support"
    : isInProgress
      ? "Cancel & request refund"
      : "Cancel job";

  const handleConfirm = () => {
    if (manualInProgress) {
      const subject = encodeURIComponent(
        `Cancel & refund request — job ${jobId}`,
      );
      const body = encodeURIComponent(
        `I'd like to cancel this job and arrange a refund.\n\nJob ID: ${jobId}`,
      );
      window.location.href = `mailto:kingshirecompany@gmail.com?subject=${subject}&body=${body}`;
      setConfirmOpen(false);
      return;
    }
    run(async () => {
      const res = await fetch(`/api/jobs/${jobId}/cancel`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Grace period expired — surface the server's specific message.
        throw new Error(
          data.error ?? "Something went wrong. Please try again.",
        );
      }

      setConfirmOpen(false);
      router.push("/dashboard/client/jobs");
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 transition-colors hover:bg-red-100"
      >
        <Trash2 size={14} />
        {isInProgress ? "Cancel job" : "Cancel posting"}
      </button>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        loading={loading}
        title={title}
        message={message}
        confirmLabel={confirmLabel}
        error={error ?? undefined}
      />
    </>
  );
}
