"use client";

import { useState } from "react";
import { X } from "lucide-react";

export default function ReportIssueButton({
  agreementId,
}: {
  agreementId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (saving) return;
    setOpen(false);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 5) {
      setError("Please describe the issue (at least 5 characters).");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(
      `/api/placements/agreements/${agreementId}/report`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not send your report.");
      setSaving(false);
      return;
    }
    setSaving(false);
    setDone(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-bold text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
      >
        Something wrong? Report an issue
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-start justify-between gap-3">
              <h2 className="text-lg font-black text-slate-950">
                Report an issue
              </h2>
              <button
                type="button"
                onClick={close}
                disabled={saving}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-40"
              >
                <X size={18} />
              </button>
            </div>

            {done ? (
              <div className="mt-2">
                <p className="text-sm text-slate-600">
                  Thanks — the KingsHire team has been notified and will look
                  into it.
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-4 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-2 space-y-3">
                <p className="text-sm text-slate-500">
                  Tell us what&apos;s gone wrong — for example the organisation
                  hasn&apos;t completed your placement or the reference they
                  promised. We&apos;ll step in to help.
                </p>
                {error && <p className="text-xs text-red-600">{error}</p>}
                <textarea
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe the issue"
                  maxLength={2000}
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={close}
                    disabled={saving}
                    className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {saving ? "Sending…" : "Send report"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
