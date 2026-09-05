"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function CancelPaymentButton({
  jobId,
  markedPaid = false,
}: {
  jobId: string;
  markedPaid?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Once the client says they've sent the transfer, cancelling is a support
  // matter (funds may have arrived) — offer a pre-filled email instead.
  if (markedPaid) {
    const subject = encodeURIComponent(`Cancel bank transfer — job ${jobId}`);
    const body = encodeURIComponent(
      `I'd like to cancel my bank transfer for this job and arrange a refund.\n\nJob ID: ${jobId}`,
    );
    return (
      <a
        href={`mailto:kingshirecompany@gmail.com?subject=${subject}&body=${body}`}
        className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
      >
        Contact support to cancel
      </a>
    );
  }

  async function handleCancel() {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/cancel-payment`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        alert(body?.error ?? "Failed to cancel payment. Please try again.");
        setLoading(false);
      }
    } catch {
      alert("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleCancel}
      disabled={loading}
      className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      Cancel &amp; reselect Kinglancer
    </button>
  );
}
