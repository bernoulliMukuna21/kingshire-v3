"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ChevronDown, ChevronUp, Star } from "lucide-react";
import type { ApplicationWithKinglancer } from "@/lib/db/applications";
import ConfirmModal from "@/components/ConfirmModal";
import { planForRole } from "@/lib/subscriptions/plans";
import { BankTransferModal, type BankTransferInfo } from "./BankTransferModal";

export function ApplicantsList({
  applications,
  job,
  locked = false,
  cardEnabled = true,
}: {
  applications: (ApplicationWithKinglancer & { cv_view_url?: string | null })[];
  job?: {
    posting_type: string;
    pay_negotiable: boolean;
    pay_amount: number | null;
    pay_cadence: string | null;
    settlement_mode: string | null;
  };
  locked?: boolean;
  cardEnabled?: boolean;
}) {
  const router = useRouter();
  const isRole = job?.posting_type === "role";
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [pendingSelectId, setPendingSelectId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<"card" | "bank_transfer">(
    cardEnabled ? "card" : "bank_transfer",
  );
  const [bankInfo, setBankInfo] = useState<BankTransferInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isRole && job?.pay_negotiable) {
    return (
      <p className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">
        This role uses negotiable pay and cannot send an offer yet. Set a fixed
        recurring pay amount before selecting an applicant.
      </p>
    );
  }

  if (applications.length === 0) {
    return (
      <p className="text-gray-500 text-sm py-4">
        No applications yet. Check back soon.
      </p>
    );
  }

  const handleSelect = async (applicationId: string) => {
    setError(null);
    setSelectingId(applicationId);
    const workerName =
      applications.find((a) => a.id === applicationId)?.kinglancer.full_name ??
      "the Kinglancer";

    const res = await fetch(`/api/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isRole
          ? {
              action: "accept",
            }
          : { action: "accept", method: payMethod },
      ),
    });

    const data = await res.json();
    setSelectingId(null);

    if (!res.ok) {
      setError(data.error ?? "Failed to select applicant.");
      return;
    }

    // Roles settle recurring pay, not a one-off card/bank-transfer escrow —
    // there's nothing to redirect to, just refresh to show the hire.
    if (data.method === "role") {
      router.refresh();
      return;
    }

    // Bank transfer: show our details + reference instead of Stripe checkout.
    if (data.method === "bank_transfer") {
      setBankInfo({
        jobId: data.jobId,
        reference: data.reference,
        amountDue: data.amountDue ?? null,
        workerName,
        bankDetails: data.bankDetails ?? null,
      });
      return;
    }

    // Card: redirect to the Stripe payment page.
    router.push(
      `/jobs/${data.jobId}/pay?cs=${encodeURIComponent(data.clientSecret)}`,
    );
  };

  const pendingApp = pendingSelectId
    ? applications.find((a) => a.id === pendingSelectId)
    : null;
  return (
    <>
      <ConfirmModal
        isOpen={pendingSelectId !== null}
        onClose={() => setPendingSelectId(null)}
        onConfirm={() => {
          if (pendingSelectId) handleSelect(pendingSelectId);
          setPendingSelectId(null);
        }}
        title="Select this Kinglancer?"
        message={
          <div className="space-y-4">
            <p>
              You&apos;re about to hire{" "}
              <strong>
                {pendingApp?.kinglancer.full_name ?? "this Kinglancer"}
              </strong>{" "}
              for the {isRole ? "role" : "job"}.{" "}
              {isRole
                ? "This sends them an offer using the role's advertised terms. They must accept before the role starts."
                : "This will move the job to payment — the selection cannot be undone."}
            </p>
            {isRole ? (
              <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                Offer:{" "}
                <strong>£{Number(job?.pay_amount ?? 0).toFixed(2)}</strong>{" "}
                {job?.pay_cadence} ·{" "}
                {job?.settlement_mode === "managed"
                  ? "KingsHire-managed settlement"
                  : "Organisation pays directly"}
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  How would you like to pay?
                </p>
                {cardEnabled ? (
                  <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                    <input
                      type="radio"
                      name="pay-method"
                      className="mt-0.5"
                      checked={payMethod === "card"}
                      onChange={() => setPayMethod("card")}
                    />
                    <span>
                      <span className="font-bold text-slate-900">
                        Pay by card
                      </span>
                      <span className="block text-xs text-slate-500">
                        Instant — held in escrow automatically.
                      </span>
                    </span>
                  </label>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <p className="font-bold">
                      Card payments need a subscription
                    </p>
                    <p className="mt-0.5">
                      Subscribe for £{planForRole("client").priceGBP}/month to
                      pay by card, or continue with a bank transfer below.{" "}
                      <Link
                        href="/dashboard/client/subscription"
                        className="font-bold underline"
                      >
                        Subscribe
                      </Link>
                    </p>
                  </div>
                )}
                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                  <input
                    type="radio"
                    name="pay-method"
                    className="mt-0.5"
                    checked={payMethod === "bank_transfer"}
                    onChange={() => setPayMethod("bank_transfer")}
                  />
                  <span>
                    <span className="font-bold text-slate-900">
                      Pay by bank transfer
                    </span>
                    <span className="block text-xs text-slate-500">
                      No card fee. We confirm once funds arrive, then the job
                      starts.
                    </span>
                  </span>
                </label>
              </div>
            )}
          </div>
        }
        confirmLabel={
          isRole
            ? "Confirm & hire"
            : payMethod === "card"
              ? "Continue to card payment"
              : "Get bank transfer details"
        }
        variant="success"
        loading={selectingId !== null}
      />
      <BankTransferModal
        info={bankInfo}
        onClose={() => {
          setBankInfo(null);
          router.refresh();
        }}
      />
      <div className="space-y-3">
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {applications.map((app) => {
          const k = app.kinglancer;
          const expanded = expandedId === app.id;

          return (
            <div
              key={app.id}
              className="bg-white border border-gray-100 rounded-2xl overflow-hidden"
            >
              {/* Header row */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpandedId(expanded ? null : app.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    setExpandedId(expanded ? null : app.id);
                }}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left cursor-pointer"
              >
                {/* Avatar — links to public profile, does not toggle */}
                <Link
                  href={`/kinglancers/${app.kinglancer_id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm shrink-0 overflow-hidden ring-2 ring-transparent hover:ring-blue-300 transition-all"
                  title={`View ${k.full_name}'s profile`}
                >
                  {k.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={k.avatar_url}
                      alt={k.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    k.full_name[0]?.toUpperCase()
                  )}
                </Link>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">
                    {k.full_name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {k.location && (
                      <span className="text-xs text-gray-400">
                        {k.location}
                      </span>
                    )}
                    {k.jobs_completed > 0 && (
                      <span className="text-xs text-gray-400">
                        · {k.jobs_completed} jobs completed
                      </span>
                    )}
                    {k.rating > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-yellow-500">
                        <Star size={11} className="fill-yellow-400" />
                        {Number(k.rating).toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>

                {expanded ? (
                  <ChevronUp size={16} className="text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown size={16} className="text-gray-400 shrink-0" />
                )}
              </div>

              {/* Expanded details */}
              {expanded && (
                <div className="px-5 pb-5 border-t border-gray-50">
                  {k.bio && (
                    <p className="text-sm text-gray-600 mt-3 mb-3">{k.bio}</p>
                  )}

                  {(k.service_tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {k.service_tags.map((s) => (
                        <span
                          key={s}
                          className="bg-blue-50 text-blue-600 text-xs font-medium px-2 py-0.5 rounded-lg"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="bg-gray-50 rounded-xl p-4 mb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Their message
                    </p>
                    <p className="text-sm text-gray-700">{app.cover_letter}</p>
                    {app.cv_view_url && (
                      <a
                        href={app.cv_view_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:underline"
                      >
                        View CV →
                      </a>
                    )}
                  </div>

                  {locked ? (
                    <p className="w-full rounded-xl bg-slate-50 py-2.5 text-center text-sm font-semibold text-slate-500">
                      Payment in progress — selection locked
                    </p>
                  ) : (
                    <button
                      onClick={() => setPendingSelectId(app.id)}
                      disabled={selectingId !== null}
                      className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      Select this Kinglancer
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
