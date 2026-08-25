"use client";

import { useState } from "react";

export default function PayMonthButton({
  agreementId,
  paymentId,
}: {
  agreementId: string;
  paymentId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setLoading(true);
    setError(null);
    const res = await fetch(
      `/api/placements/agreements/${agreementId}/payments/${paymentId}/checkout`,
      { method: "POST" },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      setError(data.error ?? "Could not start payment.");
      setLoading(false);
      return;
    }
    window.location.assign(data.url);
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        onClick={pay}
        disabled={loading}
        className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Starting…" : "Retry payment"}
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  );
}
