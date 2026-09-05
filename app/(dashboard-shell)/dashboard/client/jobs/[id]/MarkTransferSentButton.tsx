"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MarkTransferSentButton({
  jobId,
  alreadyMarked,
}: {
  jobId: string;
  alreadyMarked: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (alreadyMarked) {
    return (
      <p className="text-sm font-semibold text-blue-700">
        ✓ You told us you&apos;ve sent this. We&apos;ll confirm once it arrives.
      </p>
    );
  }

  async function markSent() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/jobs/${jobId}/mark-transfer-sent`, {
      method: "POST",
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not update. Please try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={markSent}
        disabled={loading}
        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Updating…" : "I've made the transfer"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
