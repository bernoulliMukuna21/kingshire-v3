"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

type Props = {
  jobId: string;
  jobTitle: string;
  appCount: number;
};

export default function DeleteJobButton({ jobId, jobTitle, appCount }: Props) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { loading, error, run } = useAsyncAction();

  const message =
    appCount > 0
      ? `Deleting "${jobTitle}" will permanently remove it and notify the ${appCount} applicant${appCount !== 1 ? "s" : ""} it is no longer available. This cannot be undone.`
      : `This will permanently remove "${jobTitle}". This cannot be undone.`;

  const handleConfirm = () => {
    run(async () => {
      const res = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to delete. Please try again.");
      }

      setConfirmOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 size={13} />
        Delete
      </button>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        loading={loading}
        title="Delete this job?"
        message={message}
        confirmLabel="Delete job"
        error={error ?? undefined}
      />
    </>
  );
}
