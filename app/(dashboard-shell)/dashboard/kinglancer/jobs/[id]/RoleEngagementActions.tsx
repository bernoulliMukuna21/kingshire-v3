"use client";

import { deriveRoleOfferView, rolePayLabel } from "@/lib/role-offer-view";
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
        <strong>{deriveRoleOfferView(status).label}</strong> · {rolePayLabel(amount, cadence)}.
      </p>
    );
  }

  async function respond(action: "accept" | "decline") {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/jobs/${jobId}/role/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Could not update this offer. Please retry.");
        return;
      }
      router.refresh();
    } catch {
      setError("We couldn't connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Pay:{" "}
        <strong>
          {rolePayLabel(amount, cadence)}
        </strong>{" "}
        ·{" "}
        {settlementMode === "managed"
          ? "KingsHire-managed escrow"
          : "Organisation pays directly"}
      </p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={() => respond("accept")}
        disabled={loading}
        className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {loading ? "Updating offer..." : "Accept role terms"}
      </button>
      <button
        type="button"
        onClick={() => respond("decline")}
        disabled={loading}
        className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 disabled:opacity-50"
      >
        Decline offer
      </button>
    </div>
  );
}
