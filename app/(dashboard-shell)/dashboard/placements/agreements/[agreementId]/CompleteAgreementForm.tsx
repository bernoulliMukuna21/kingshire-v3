"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  const [title, setTitle] = useState(defaultTitle);
  const [summary, setSummary] = useState("");
  const [skills, setSkills] = useState("");
  const [outcome, setOutcome] = useState("");
  const [referenceText, setReferenceText] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    router.refresh();
  }

  return (
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
      <textarea
        className={`${field} resize-none`}
        rows={2}
        value={referenceText}
        onChange={(e) => setReferenceText(e.target.value)}
        placeholder={
          referenceRequired
            ? "Reference (required — you promised one)"
            : "Reference (optional)"
        }
      />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        Show on the participant&apos;s public profile
      </label>
      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {saving ? "Completing…" : "Complete & publish record"}
      </button>
    </form>
  );
}
