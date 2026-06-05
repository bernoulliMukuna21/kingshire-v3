"use client";

import { Loader2, ExternalLink } from "lucide-react";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

export default function StripeLoginButton() {
  const { loading, error, setError, run } = useAsyncAction();

  const handleClick = () =>
    run(async () => {
      const res = await fetch("/api/stripe/connect-login", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      } else {
        setError(
          data.error ?? "Could not open Stripe dashboard. Please try again.",
        );
      }
    });

  return (
    <div className="shrink-0">
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <ExternalLink size={14} />
        )}
        View Stripe dashboard
      </button>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
