"use client";

import { useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";

export type BankTransferInfo = {
  jobId: string;
  reference: string;
  amountDue: number | null;
  workerName: string;
  bankDetails: {
    accountName: string;
    sortCode: string;
    accountNumber: string;
    isPlaceholder?: boolean;
  } | null;
};

// Shared by DirectRequestActions and ApplicantsList — both can trigger a
// bank-transfer payment and need to show our details + reference.
export function BankTransferModal({
  info,
  onClose,
}: {
  info: BankTransferInfo | null;
  onClose: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markSent() {
    if (!info) return;
    setSending(true);
    setError(null);
    const res = await fetch(`/api/jobs/${info.jobId}/mark-transfer-sent`, {
      method: "POST",
    });
    setSending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not update. Please try again.");
      return;
    }
    onClose();
  }

  return (
    <ConfirmModal
      isOpen={info !== null}
      onClose={onClose}
      onConfirm={markSent}
      loading={sending}
      error={error ?? undefined}
      title="Pay by bank transfer"
      confirmLabel="I've made the transfer"
      cancelLabel="Close"
      message={
        info && (
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              Transfer{" "}
              {info.amountDue != null && (
                <strong className="text-slate-900">
                  £{info.amountDue.toFixed(2)}
                </strong>
              )}{" "}
              to us using the reference below.
            </p>
            {info.bankDetails ? (
              <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs">
                <div>Account name: {info.bankDetails.accountName}</div>
                <div>Sort code: {info.bankDetails.sortCode}</div>
                <div>Account number: {info.bankDetails.accountNumber}</div>
              </div>
            ) : (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Contact us to get our bank details and complete the transfer.
              </p>
            )}
            {info.bankDetails?.isPlaceholder && (
              <p className="text-xs font-bold text-amber-700">
                These are TEST details — do not send real money.
              </p>
            )}
            <p>
              Payment reference:{" "}
              <strong className="font-mono text-slate-900">
                {info.reference.slice(0, 8)}
              </strong>
            </p>
            <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              {`Once you've sent the money, tap "I've made the transfer" so we know to check. We'll hire ${info.workerName} once it arrives — they won't start until we've confirmed it.`}
            </p>
          </div>
        )
      }
    />
  );
}
