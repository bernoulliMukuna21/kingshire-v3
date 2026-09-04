"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { DirectRequestStatus } from "@/lib/jobs";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Star,
  Flag,
  Users,
} from "lucide-react";
import type { ApplicationWithKinglancer } from "@/lib/db/applications";
import ConfirmModal from "@/components/ConfirmModal";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

// ── Open to all (after declined/cancelled direct request) ───

function OpenToAllButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { loading, error, run } = useAsyncAction();

  const handleConfirm = () => {
    run(async () => {
      const res = await fetch(`/api/jobs/${jobId}/open-to-all`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setConfirmOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-blue-700"
      >
        <Users size={15} />
        Open to all Kinglancers
      </button>
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        loading={loading}
        title="Open to all Kinglancers?"
        message="This will remove the direct request and list the job publicly. Any Kinglancer will be able to apply."
        confirmLabel="Open listing"
      />
    </>
  );
}

// ── Apply form (for kinglancers) ──────────────────────────

export function ApplyForm({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [coverLetter, setCoverLetter] = useState("");
  const [done, setDone] = useState(false);
  const { loading, error, setError, run } = useAsyncAction();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (coverLetter.trim().length < 20) {
      setError("Please write at least a couple of sentences.");
      return;
    }

    run(async () => {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, cover_letter: coverLetter }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.code === "PROFILE_INCOMPLETE") {
          setError("PROFILE_INCOMPLETE");
        } else {
          setError(data.error ?? "Failed to submit. Please try again.");
        }
        return;
      }

      setDone(true);
      router.refresh();
    });
  };

  if (done) {
    return (
      <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-2xl p-5">
        <CheckCircle size={20} className="text-green-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-green-800">Application submitted!</p>
          <p className="text-green-700 text-sm mt-0.5">
            The client will review your application and get in touch if
            selected.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Your message to the client
        </label>
        <textarea
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value)}
          rows={4}
          maxLength={1000}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all resize-none"
          placeholder="Introduce yourself and explain why you're a great fit for this job..."
        />
        <p className="text-xs text-gray-400 mt-1 text-right">
          {coverLetter.length}/1000
        </p>
      </div>

      {error === "PROFILE_INCOMPLETE" ? (
        <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>
            Your profile is incomplete.{" "}
            <Link
              href="/dashboard/profile"
              className="font-bold underline underline-offset-2 hover:text-red-800"
            >
              Add an &lsquo;About you&rsquo; section and a service rate
            </Link>{" "}
            before applying.
          </span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all hover:scale-[1.01] shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Submitting...
          </>
        ) : (
          "Apply for this job"
        )}
      </button>
    </form>
  );
}

// ── Direct request actions ────────────────────────────────

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

  const startPayment = async () => {
    setError(null);
    setLoadingAction("direct_pay");
    try {
      const res = await fetch(`/api/jobs/${jobId}/direct-pay`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Failed to start payment.");
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
        <button
          type="button"
          onClick={startPayment}
          disabled={loadingAction !== null}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 disabled:opacity-50"
        >
          {loadingAction === "direct_pay"
            ? "Starting payment..."
            : "Fund escrow and start job"}
        </button>
      )}

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

// ── Applicants list (for the client who owns the job) ────

type BankTransferInfo = {
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

export function ApplicantsList({
  applications,
}: {
  applications: ApplicationWithKinglancer[];
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [pendingSelectId, setPendingSelectId] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<"card" | "bank_transfer">("card");
  const [bankInfo, setBankInfo] = useState<BankTransferInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      body: JSON.stringify({ action: "accept", method: payMethod }),
    });

    const data = await res.json();
    setSelectingId(null);

    if (!res.ok) {
      setError(data.error ?? "Failed to select applicant.");
      return;
    }

    // Bank transfer: show our details + reference instead of Stripe checkout.
    if (data.method === "bank_transfer") {
      setBankInfo({
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
              for the job. This will move the job to payment — the selection
              cannot be undone.
            </p>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                How would you like to pay?
              </p>
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                <input
                  type="radio"
                  name="pay-method"
                  className="mt-0.5"
                  checked={payMethod === "card"}
                  onChange={() => setPayMethod("card")}
                />
                <span>
                  <span className="font-bold text-slate-900">Pay by card</span>
                  <span className="block text-xs text-slate-500">
                    Instant — held in escrow automatically.
                  </span>
                </span>
              </label>
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
          </div>
        }
        confirmLabel={
          payMethod === "card"
            ? "Continue to card payment"
            : "Get bank transfer details"
        }
        variant="success"
        loading={selectingId !== null}
      />
      <ConfirmModal
        isOpen={bankInfo !== null}
        onClose={() => {
          setBankInfo(null);
          router.refresh();
        }}
        onConfirm={() => {
          setBankInfo(null);
          router.refresh();
        }}
        title="Pay by bank transfer"
        confirmLabel="Done"
        message={
          bankInfo && (
            <div className="space-y-3 text-sm text-slate-600">
              <p>
                Transfer{" "}
                {bankInfo.amountDue != null && (
                  <strong className="text-slate-900">
                    £{bankInfo.amountDue.toFixed(2)}
                  </strong>
                )}{" "}
                to us using the reference below.
              </p>
              {bankInfo.bankDetails ? (
                <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs">
                  <div>Account name: {bankInfo.bankDetails.accountName}</div>
                  <div>Sort code: {bankInfo.bankDetails.sortCode}</div>
                  <div>
                    Account number: {bankInfo.bankDetails.accountNumber}
                  </div>
                </div>
              ) : (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  Contact us to get our bank details and complete the transfer.
                </p>
              )}
              {bankInfo.bankDetails?.isPlaceholder && (
                <p className="text-xs font-bold text-amber-700">
                  These are TEST details — do not send real money.
                </p>
              )}
              <p>
                Payment reference:{" "}
                <strong className="font-mono text-slate-900">
                  {bankInfo.reference.slice(0, 8)}
                </strong>
              </p>
              <p className="text-xs text-slate-500">
                Once we confirm your transfer, {bankInfo.workerName} is hired and
                the job starts. We&apos;ll email you when it&apos;s confirmed.
              </p>
            </div>
          )
        }
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
                  </div>

                  <button
                    onClick={() => setPendingSelectId(app.id)}
                    disabled={selectingId !== null}
                    className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    Select this Kinglancer
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Kinglancer: mark work as done ────────────────────────

export function KinglancerCompleteButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { loading, error, setError, run } = useAsyncAction();

  const handleConfirm = () => {
    setConfirmOpen(false);
    run(async () => {
      const res = await fetch(`/api/jobs/${jobId}/complete`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to mark as complete.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <>
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        title="Mark work as done?"
        message="This tells the client you've completed the work. They'll check it and approve — releasing payment to you. You can't undo this once submitted."
        confirmLabel="Yes, mark as done"
        variant="success"
        loading={loading}
      />
      <div className="space-y-3">
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={loading}
          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <CheckCircle size={16} />
              Mark work as done
            </>
          )}
        </button>
      </div>
    </>
  );
}

// ── Client: approve work + raise dispute ─────────────────

export function ClientApproveActions({
  jobId,
  showApprove,
}: {
  jobId: string;
  showApprove: boolean;
}) {
  const router = useRouter();
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState("");
  const approveAction = useAsyncAction();
  const disputeAction = useAsyncAction();
  const error = approveAction.error ?? disputeAction.error;

  const handleApprove = () => {
    setApproveConfirmOpen(false);
    approveAction.run(async () => {
      const res = await fetch(`/api/jobs/${jobId}/approve`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        approveAction.setError(data.error ?? "Failed to release payment.");
        return;
      }
      router.refresh();
    });
  };

  const handleDispute = (e: React.FormEvent) => {
    e.preventDefault();
    disputeAction.run(async () => {
      const res = await fetch(`/api/jobs/${jobId}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        disputeAction.setError(data.error ?? "Failed to raise dispute.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <>
      <ConfirmModal
        isOpen={approveConfirmOpen}
        onClose={() => setApproveConfirmOpen(false)}
        onConfirm={handleApprove}
        title="Release payment?"
        message="This confirms the work is complete and immediately releases the escrowed payment to the Kinglancer. This cannot be undone."
        confirmLabel="Yes, release payment"
        variant="success"
        loading={approveAction.loading}
      />
      <div className="space-y-3">
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {showApprove && (
          <button
            onClick={() => setApproveConfirmOpen(true)}
            disabled={approveAction.loading}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {approveAction.loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Releasing payment...
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                Approve &amp; release payment
              </>
            )}
          </button>
        )}

        {!disputeOpen ? (
          <button
            onClick={() => setDisputeOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-all"
          >
            <Flag size={15} />
            Raise a dispute
          </button>
        ) : (
          <form onSubmit={handleDispute} className="space-y-3">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Briefly describe the issue..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm resize-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDisputeOpen(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={disputeAction.loading}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {disputeAction.loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  "Submit dispute"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
