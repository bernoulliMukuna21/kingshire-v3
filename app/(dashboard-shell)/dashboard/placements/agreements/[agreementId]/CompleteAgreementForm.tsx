"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

const field =
  "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function CompleteAgreementForm({
  agreementId,
  defaultTitle,
  referenceRequired = false,
}: {
  agreementId: string;
  defaultTitle: string;
  referenceRequired?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [summary, setSummary] = useState("");
  const [skills, setSkills] = useState("");
  const [outcome, setOutcome] = useState("");
  const [referenceText, setReferenceText] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (saving) return;
    setOpen(false);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (referenceRequired && !referenceText.trim()) {
      setError("This placement promised a reference — please write one.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(
      `/api/placements/agreements/${agreementId}/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          summary: summary || null,
          outcome: outcome || null,
          reference_text: referenceText || null,
          is_public: isPublic,
          skills: skills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not complete the placement.");
      setSaving(false);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-emerald-500/25 hover:bg-emerald-700"
      >
        Complete placement
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={close}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-start justify-between gap-3">
              <h2 className="text-lg font-black text-slate-950">
                Complete placement
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
            <p className="mb-4 text-sm text-slate-500">
              This frees the participant seat and publishes a verified
              experience record on their profile (once an admin approves it).
            </p>

            <form onSubmit={submit} className="space-y-3">
              {error && <p className="text-xs text-red-600">{error}</p>}
              <input
                className={field}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Experience title"
                maxLength={200}
              />
              <textarea
                className={`${field} resize-none`}
                rows={2}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Summary of what they did (optional)"
              />
              <input
                className={field}
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="Skills, comma-separated (optional)"
              />
              <input
                className={field}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="Outcome delivered (optional)"
              />
              {referenceRequired && (
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-600">
                    Reference — you promised one
                  </label>
                  <textarea
                    className={`${field} resize-none`}
                    rows={3}
                    value={referenceText}
                    onChange={(e) => setReferenceText(e.target.value)}
                    placeholder="Write the reference you promised the Kinglancer"
                  />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Show on the participant&apos;s public profile
              </label>

              <div className="flex gap-3 pt-1">
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
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? "Completing…" : "Complete & publish record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
