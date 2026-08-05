"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const field =
  "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function MilestoneAddForm({
  agreementId,
}: {
  agreementId: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(
      `/api/placements/agreements/${agreementId}/milestones`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          due_date: dueDate || null,
        }),
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not add milestone.");
      setSaving(false);
      return;
    }
    setTitle("");
    setDescription("");
    setDueDate("");
    setSaving(false);
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3"
    >
      {error && <p className="text-xs text-red-600">{error}</p>}
      <input
        className={field}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Milestone title"
        maxLength={200}
      />
      <input
        className={field}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add milestone"}
        </button>
      </div>
    </form>
  );
}
