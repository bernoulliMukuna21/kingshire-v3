"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Users } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

// Shown after a direct request is declined/cancelled, so the client can
// re-list the job publicly instead of it being stuck invite-only.
export function OpenToAllButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { loading, error, run } = useAsyncAction();

  const handleConfirm = () => {
    run(async () => {
      const res = await fetch(`/api/jobs/${jobId}/open-to-all`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setConfirmOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-blue-700"
      >
        <Users size={15} />
        Open to all Kinglancers
      </button>
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        loading={loading}
        title="Open to all Kinglancers?"
        message="This will remove the direct request and list the job publicly. Any Kinglancer will be able to apply."
        confirmLabel="Open listing"
      />
    </>
  );
}
