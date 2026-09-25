"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RoleEngagementActions({
  jobId,
  status,
  cadence,
  amount,
  settlementMode,
}: {
  jobId: string;
  status: string;
  cadence: string;
  amount: number;
  settlementMode: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== "pending_acceptance") {
    return (
      <p className="text-sm text-slate-600">
        Role agreement: <strong>{status.replaceAll("_", " ")}</strong>. Pay is £
        {amount.toFixed(2)} {cadence}.
      </p>
    );
  }

  async function accept() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/jobs/${jobId}/role/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Could not accept this role.");
      return;
    }
    router.refresh();
  }

  async function decline() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/jobs/${jobId}/role/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decline" }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Could not decline this role.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Pay:{" "}
        <strong>
          £{amount.toFixed(2)} {cadence}
        </strong>{" "}
        ·{" "}
        {settlementMode === "managed"
          ? "KingsHire-managed escrow"
          : "Organisation pays directly"}
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={accept}
        disabled={loading}
        className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {loading ? "Accepting..." : "Accept role terms"}
      </button>
      <button
        type="button"
        onClick={decline}
        disabled={loading}
        className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 disabled:opacity-50"
      >
        Decline offer
      </button>
    </div>
  );
}
