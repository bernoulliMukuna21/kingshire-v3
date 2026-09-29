"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { DirectRequestStatus } from "@/lib/jobs";
import { planForRole } from "@/lib/subscriptions/plans";
import { AlertCircle } from "lucide-react";
import { OpenToAllButton } from "./OpenToAllButton";
import { BankTransferModal, type BankTransferInfo } from "./BankTransferModal";

export function DirectRequestActions({
  jobId,
  viewerRole,
  isOwner,
  isInvitedKinglancer,
  status,
  message,
  counterBudget,
  counterRateType,
  counterDeadline,
  invitedKinglancer,
  cardEnabled = true,
}: {
  jobId: string;
  viewerRole: string | null | undefined;
  isOwner: boolean;
  isInvitedKinglancer: boolean;
  status: DirectRequestStatus;
  message: string | null;
  counterBudget: number | null;
  counterRateType: "fixed" | "per_hour" | "per_day" | null;
  counterDeadline: string | null;
  invitedKinglancer?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  cardEnabled?: boolean;
}) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showCounter, setShowCounter] = useState(false);
  const [proposedBudget, setProposedBudget] = useState(
    counterBudget ? String(counterBudget) : "",
  );
  const [proposedRateType, setProposedRateType] = useState<
    "fixed" | "per_hour" | "per_day"
  >(counterRateType ?? "fixed");
  const [proposedDeadline, setProposedDeadline] = useState(
    counterDeadline ?? "",
  );
  const [counterMessage, setCounterMessage] = useState(message ?? "");
  const [error, setError] = useState<string | null>(null);
  const [bankInfo, setBankInfo] = useState<BankTransferInfo | null>(null);

  const submitAction = async (
    action: string,
    extraBody: Record<string, unknown> = {},
  ) => {
    setError(null);
    setLoadingAction(action);
    try {
      const res = await fetch(`/api/jobs/${jobId}/direct-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extraBody }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      setShowCounter(false);
      router.refresh();
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoadingAction(null);
    }
  };

  const startPayment = async (method: "card" | "bank_transfer" = "card") => {
    setError(null);
    setLoadingAction(
      method === "bank_transfer" ? "direct_pay_bank" : "direct_pay",
    );
    try {
      const res = await fetch(`/api/jobs/${jobId}/direct-pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Failed to start payment.");
        return;
      }

      if (data.method === "bank_transfer") {
        setBankInfo({
          jobId: data.jobId,
          reference: data.reference,
          amountDue: data.amountDue ?? null,
          workerName: invitedKinglancer?.full_name ?? "the Kinglancer",
          bankDetails: data.bankDetails ?? null,
        });
        return;
      }

      router.push(
        `/jobs/${data.jobId}/pay?cs=${encodeURIComponent(data.clientSecret)}`,
      );
    } catch {
      setError("Failed to start payment.");
    } finally {
      setLoadingAction(null);
    }
  };

  if (!status) return null;

  if (viewerRole === "admin") {
    return (
      <p className="text-sm text-gray-500">
        Admin accounts can inspect direct requests but cannot act on them.
      </p>
    );
  }

  if (status === "declined" || status === "cancelled") {
    const isDeclined = status === "declined";
    return (
      <div className="space-y-3">
        <div
          className={`rounded-2xl p-4 text-sm font-semibold ${
            isDeclined
              ? "border border-red-100 bg-red-50 text-red-700"
              : "border border-slate-100 bg-slate-50 text-slate-500"
          }`}
        >
          {isDeclined
            ? `${invitedKinglancer?.full_name?.split(" ")[0] ?? "The Kinglancer"} declined this request.`
            : "This direct request was cancelled."}
        </div>
        {isOwner && <OpenToAllButton jobId={jobId} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {isInvitedKinglancer && status === "changes_requested" && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-800">
          <p className="font-bold">Waiting for the client to respond</p>
          <p className="mt-0.5 text-blue-700/80">
            You&apos;ve sent your proposed changes. Once the client reviews
            them, you&apos;ll be able to take further action.
          </p>
        </div>
      )}

      {isInvitedKinglancer &&
        status !== "accepted_pending_payment" &&
        status !== "changes_requested" && (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => submitAction("accept")}
                disabled={loadingAction !== null}
                className="rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-green-700 disabled:opacity-50"
              >
                {loadingAction === "accept" ? "Accepting..." : "Accept request"}
              </button>
              <button
                type="button"
                onClick={() => setShowCounter((value) => !value)}
                disabled={loadingAction !== null}
                className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 transition-all hover:bg-blue-100 disabled:opacity-50"
              >
                Request changes
              </button>
            </div>
            <button
              type="button"
              onClick={() => submitAction("decline")}
              disabled={loadingAction !== null}
              className="w-full rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 transition-all hover:bg-red-100 disabled:opacity-50"
            >
              {loadingAction === "decline" ? "Declining..." : "Decline request"}
            </button>

            {showCounter && (
              <form
                className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitAction("request_changes", {
                    proposed_budget: proposedBudget,
                    proposed_rate_type: proposedRateType,
                    proposed_deadline: proposedDeadline || null,
                    message: counterMessage,
                  });
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-500">
                      Proposed budget
                    </label>
                    <input
                      type="number"
                      min="5"
                      step="0.01"
                      inputMode="decimal"
                      value={proposedBudget}
                      onChange={(event) =>
                        setProposedBudget(event.target.value)
                      }
                      className="w-full rounded-xl border border-blue-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="e.g. 150"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-500">
                      Rate type
                    </label>
                    <select
                      value={proposedRateType}
                      onChange={(event) =>
                        setProposedRateType(
                          event.target.value as
                            | "fixed"
                            | "per_hour"
                            | "per_day",
                        )
                      }
                      className="w-full rounded-xl border border-blue-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="fixed">Fixed</option>
                      <option value="per_hour">Per hour</option>
                      <option value="per_day">Per day</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">
                    Proposed deadline
                  </label>
                  <input
                    type="date"
                    value={proposedDeadline}
                    onChange={(event) =>
                      setProposedDeadline(event.target.value)
                    }
                    className="w-full rounded-xl border border-blue-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500">
                    Message to client
                  </label>
                  <textarea
                    value={counterMessage}
                    onChange={(event) => setCounterMessage(event.target.value)}
                    rows={3}
                    maxLength={1000}
                    className="w-full resize-none rounded-xl border border-blue-100 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Explain why the request needs changing..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={loadingAction !== null}
                  className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-blue-700 disabled:opacity-50"
                >
                  {loadingAction === "request_changes"
                    ? "Sending..."
                    : "Send requested changes"}
                </button>
              </form>
            )}
          </>
        )}

      {isInvitedKinglancer && status === "accepted_pending_payment" && (
        <p className="rounded-2xl bg-green-50 p-4 text-sm font-semibold text-green-700">
          You accepted this request. Waiting for the client to fund escrow.
        </p>
      )}

      {isOwner && status === "pending" && (
        <div className="space-y-3">
          {invitedKinglancer && (
            <Link
              href={`/kinglancers/${invitedKinglancer.id}`}
              className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition-colors hover:border-blue-100 hover:bg-blue-50/50"
            >
              {invitedKinglancer.avatar_url ? (
                <Image
                  src={invitedKinglancer.avatar_url}
                  alt={invitedKinglancer.full_name ?? "Kinglancer"}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                  {(invitedKinglancer.full_name ?? "?")[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">
                  {invitedKinglancer.full_name}
                </p>
                <p className="text-xs text-blue-600">View profile →</p>
              </div>
            </Link>
          )}
          <p className="rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-700">
            Waiting for{" "}
            {invitedKinglancer?.full_name?.split(" ")[0] ?? "the Kinglancer"} to
            respond to your request.
          </p>
        </div>
      )}

      {isOwner && status === "changes_requested" && (
        <div className="space-y-3 rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-sm font-black text-amber-900">
            The Kinglancer requested changes
          </p>
          {message && <p className="text-sm text-amber-800">{message}</p>}
          <div className="flex flex-wrap gap-2 text-xs font-bold text-amber-800">
            {counterBudget && <span>Budget: £{counterBudget}</span>}
            {counterRateType && (
              <span>Rate: {counterRateType.replace("_", " ")}</span>
            )}
            {counterDeadline && <span>Deadline: {counterDeadline}</span>}
          </div>
          <button
            type="button"
            onClick={() => submitAction("accept_changes")}
            disabled={loadingAction !== null}
            className="w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-amber-700 disabled:opacity-50"
          >
            {loadingAction === "accept_changes"
              ? "Accepting..."
              : "Accept changes"}
          </button>
        </div>
      )}

      {isOwner && status === "accepted_pending_payment" && (
        <div className="space-y-2">
          {cardEnabled ? (
            <button
              type="button"
              onClick={() => startPayment("card")}
              disabled={loadingAction !== null}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 disabled:opacity-50"
            >
              {loadingAction === "direct_pay"
                ? "Starting payment..."
                : "Fund escrow by card"}
            </button>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-bold">Card payments need a subscription</p>
              <p className="mt-0.5">
                Subscribe for £{planForRole("client").priceGBP}/month to fund
                escrow by card, or pay by bank transfer below.{" "}
                <Link
                  href="/dashboard/client/subscription"
                  className="font-bold underline"
                >
                  Subscribe
                </Link>
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => startPayment("bank_transfer")}
            disabled={loadingAction !== null}
            className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-bold text-blue-700 transition-all hover:bg-blue-50 disabled:opacity-50"
          >
            {loadingAction === "direct_pay_bank"
              ? "Preparing..."
              : "Pay by bank transfer (no card fee)"}
          </button>
        </div>
      )}

      <BankTransferModal
        info={bankInfo}
        onClose={() => {
          setBankInfo(null);
          router.refresh();
        }}
      />

      {isOwner &&
        ["pending", "changes_requested", "accepted_pending_payment"].includes(
          status,
        ) && (
          <button
            type="button"
            onClick={() => submitAction("cancel")}
            disabled={loadingAction !== null}
            className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-500 transition-all hover:bg-slate-200 disabled:opacity-50"
          >
            Cancel request
          </button>
        )}
    </div>
  );
}
