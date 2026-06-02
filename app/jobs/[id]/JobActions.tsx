"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Star,
  Flag,
} from "lucide-react";
import type { ApplicationWithKinglancer } from "@/lib/db/applications";
import ConfirmModal from "@/components/ConfirmModal";

// ── Apply form (for kinglancers) ──────────────────────────

export function ApplyForm({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [coverLetter, setCoverLetter] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (coverLetter.trim().length < 20) {
      setError("Please write at least a couple of sentences.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: jobId, cover_letter: coverLetter }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to submit. Please try again.");
      return;
    }

    setDone(true);
    router.refresh();
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

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

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

// ── Applicants list (for the client who owns the job) ────

export function ApplicantsList({
  applications,
  jobId,
}: {
  applications: ApplicationWithKinglancer[];
  jobId: string;
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [pendingSelectId, setPendingSelectId] = useState<string | null>(null);
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

    const res = await fetch(`/api/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });

    const data = await res.json();
    setSelectingId(null);

    if (!res.ok) {
      setError(data.error ?? "Failed to select applicant.");
      return;
    }

    // Redirect to payment page with Stripe client secret
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
          <>
            You&apos;re about to hire{" "}
            <strong>
              {pendingApp?.kinglancer.full_name ?? "this Kinglancer"}
            </strong>{" "}
            for the job. This will move the job to payment — the selection
            cannot be undone.
          </>
        }
        confirmLabel="Yes, select them"
        variant="success"
        loading={selectingId !== null}
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
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : app.id)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm shrink-0 overflow-hidden">
                  {k.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={k.avatar_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    k.full_name[0]?.toUpperCase()
                  )}
                </div>

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
              </button>

              {/* Expanded details */}
              {expanded && (
                <div className="px-5 pb-5 border-t border-gray-50">
                  {k.bio && (
                    <p className="text-sm text-gray-600 mt-3 mb-3">{k.bio}</p>
                  )}

                  {(k.skills ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {k.skills.map((s) => (
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
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setConfirmOpen(false);
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/jobs/${jobId}/complete`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to mark as complete.");
      return;
    }
    router.refresh();
  };

  return (
    <>
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        title="Mark work as done?"
        message="This tells the client you've completed the work. They'll be asked to review and approve — releasing payment to you. You can't undo this once submitted."
        confirmLabel="Yes, submit for review"
        variant="success"
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
  const [approving, setApproving] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [disputing, setDisputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setApproveConfirmOpen(false);
    setApproving(true);
    setError(null);
    const res = await fetch(`/api/jobs/${jobId}/approve`, { method: "POST" });
    const data = await res.json();
    setApproving(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to release payment.");
      return;
    }
    router.refresh();
  };

  const handleDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisputing(true);
    setError(null);
    const res = await fetch(`/api/jobs/${jobId}/dispute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    setDisputing(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to raise dispute.");
      return;
    }
    router.refresh();
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
        loading={approving}
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
            disabled={approving}
            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {approving ? (
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
            className="w-full py-2.5 border border-red-200 text-red-600 hover:bg-red-50 font-semibold rounded-xl transition-all text-sm flex items-center justify-center gap-2"
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
                disabled={disputing}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {disputing ? (
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
