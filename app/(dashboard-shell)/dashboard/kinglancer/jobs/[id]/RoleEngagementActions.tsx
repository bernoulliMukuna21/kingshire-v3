"use client";

import { deriveRoleOfferView, rolePayLabel } from "@/lib/role-offer-view";
import ConfirmModal from "@/components/ConfirmModal";
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
  const [declineOpen, setDeclineOpen] = useState(false);
  const [responseAction, setResponseAction] = useState<"accept" | "decline" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (responseAction) return <p role="status" className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">{responseAction === "accept" ? "Offer accepted. The organisation needs to fund the first payment period before the role becomes active." : "Offer declined. You can return to My Jobs to review your other applications."}</p>;

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
      setDeclineOpen(false);
      setResponseAction(action);
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
      <p className="text-sm text-slate-500">Accepting confirms these terms. The role becomes active once the organisation funds the first payment period.</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-col gap-3 sm:flex-row">
      <button
        type="button"
        onClick={() => respond("accept")}
        disabled={loading}
        className="min-h-11 rounded-xl bg-blue-600 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {loading ? "Updating offer..." : "Accept offer"}
      </button>
      <button
        type="button"
        onClick={() => { setError(null); setDeclineOpen(true); }}
        disabled={loading}
        className="min-h-11 rounded-xl border border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50"
      >
        Decline offer
      </button>
      </div>
      <ConfirmModal isOpen={declineOpen} onClose={() => { if (!loading) setDeclineOpen(false); }} onConfirm={() => respond("decline")} title="Decline this offer?" message="You will not join this role under this offer. The organisation will be able to offer it to another Kinglancer." confirmLabel="Decline offer" variant="danger" loading={loading} error={error ?? undefined} />
    </div>
  );
}
