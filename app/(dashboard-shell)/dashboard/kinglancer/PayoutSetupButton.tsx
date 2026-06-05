"use client";

import { Loader2 } from "lucide-react";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

export default function PayoutSetupButton() {
  const { loading, error, setError, run } = useAsyncAction();

  const handleClick = () =>
    run(async () => {
      const res = await fetch("/api/stripe/connect-onboard", {
        method: "POST",
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Failed to start payout setup. Please try again.");
    });

  return (
    <div className="shrink-0">
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : null}
        Set up payouts
      </button>
      {error && <p className="mt-1.5 text-xs text-red-600 max-w-xs">{error}</p>}
    </div>
  );
}
