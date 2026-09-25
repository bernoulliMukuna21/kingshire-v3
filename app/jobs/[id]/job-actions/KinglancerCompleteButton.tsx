"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

export function KinglancerCompleteButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { loading, error, setError, run } = useAsyncAction();

  const handleConfirm = () => {
    setConfirmOpen(false);
    run(async () => {
      const res = await fetch(`/api/jobs/${jobId}/complete`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to mark as complete.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <>
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        title="Mark work as done?"
        message="This tells the client you've completed the work. They'll check it and approve — releasing payment to you. You can't undo this once submitted."
        confirmLabel="Yes, mark as done"
        variant="success"
        loading={loading}
      />
      <div className="space-y-3">
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={loading}
          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <CheckCircle size={16} />
              Mark work as done
            </>
          )}
        </button>
      </div>
    </>
  );
}
