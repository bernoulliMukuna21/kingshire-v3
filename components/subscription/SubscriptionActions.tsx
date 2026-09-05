"use client";

import { useState } from "react";
import { Loader2, AlertCircle, CreditCard, Settings } from "lucide-react";

function useRedirectAction(endpoint: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      window.location.assign(data.url as string);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return { loading, error, go };
}

export function SubscribeButton({ priceGBP }: { priceGBP: number }) {
  const { loading, error, go } = useRedirectAction("/api/subscription/checkout");
  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={go}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <CreditCard size={16} />
        )}
        Subscribe — £{priceGBP}/month
      </button>
    </div>
  );
}

export function ManageSubscriptionButton() {
  const { loading, error, go } = useRedirectAction("/api/subscription/portal");
  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={go}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Settings size={16} />
        )}
        Manage subscription
      </button>
    </div>
  );
}
