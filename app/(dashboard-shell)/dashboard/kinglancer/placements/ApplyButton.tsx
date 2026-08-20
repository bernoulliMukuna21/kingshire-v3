"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ApplyButton({ placementId }: { placementId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/placements/${placementId}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    setSaving(false);
    if (!res.ok) {
      // 409 means an application already exists — treat it as applied.
      if (res.status === 409) {
        setApplied(true);
        setOpen(false);
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not apply.");
      return;
    }
    setApplied(true);
    setOpen(false);
    router.refresh();
  }

  if (applied) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700">
        ✓ Application sent
      </span>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
      >
        Apply
      </button>
    );
  }

  return (
    <div className="w-full space-y-3">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={5}
        maxLength={2000}
        placeholder="Introduce yourself and say why you'd be a great fit (optional)."
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={apply}
          disabled={saving}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Sending…" : "Send application"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
