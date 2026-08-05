"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CheckInForm({ agreementId }: { agreementId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch(
      `/api/placements/agreements/${agreementId}/check-ins`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not post the check-in.");
      setSaving(false);
      return;
    }
    setNote("");
    setSaving(false);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <textarea
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows={2}
        maxLength={2000}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Post a check-in…"
      />
      <button
        type="submit"
        disabled={saving || !note.trim()}
        className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Posting…" : "Post check-in"}
      </button>
    </form>
  );
}
