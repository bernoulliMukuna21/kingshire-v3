"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function PlacementForm({
  organisationId,
  categories,
}: {
  organisationId: string;
  categories: string[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [contribution, setContribution] = useState("");
  const [reward, setReward] = useState("");
  const [location, setLocation] = useState("");
  const [isRemote, setIsRemote] = useState(false);
  const [weeklyHours, setWeeklyHours] = useState("8");
  const [durationWeeks, setDurationWeeks] = useState("8");
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleCategory(c: string) {
    setSelected((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(
      `/api/organisations/${organisationId}/placements`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          summary,
          categories: selected,
          contribution,
          reward,
          location: location || null,
          is_remote: isRemote,
          weekly_hours: Number(weeklyHours),
          duration_weeks: Number(durationWeeks),
          start_date: startDate || null,
        }),
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not create the placement.");
      setSaving(false);
      return;
    }
    router.push(`/dashboard/organisations/${organisationId}/placements`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <Field label="Title">
        <input
          className={fieldClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={140}
          placeholder="e.g. Media team assistant placement"
        />
      </Field>
      <Field label="Summary">
        <textarea
          className={`${fieldClass} resize-none`}
          rows={3}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          maxLength={4000}
          placeholder="What the placement is about."
        />
      </Field>
      <Field label="Categories">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => toggleCategory(c)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                selected.includes(c)
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </Field>
      <Field label="What the participant will contribute">
        <textarea
          className={`${fieldClass} resize-none`}
          rows={3}
          value={contribution}
          onChange={(e) => setContribution(e.target.value)}
          maxLength={4000}
          placeholder="The work or activities they'll take part in."
        />
      </Field>
      <Field label="What the participant will receive">
        <textarea
          className={`${fieldClass} resize-none`}
          rows={3}
          value={reward}
          onChange={(e) => setReward(e.target.value)}
          maxLength={4000}
          placeholder="Mentoring, training, a reference, a verified experience record…"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Weekly hours (max 16)">
          <input
            type="number"
            min={1}
            max={16}
            className={fieldClass}
            value={weeklyHours}
            onChange={(e) => setWeeklyHours(e.target.value)}
          />
        </Field>
        <Field label="Duration in weeks (max 26)">
          <input
            type="number"
            min={1}
            max={26}
            className={fieldClass}
            value={durationWeeks}
            onChange={(e) => setDurationWeeks(e.target.value)}
          />
        </Field>
        <Field label="Location">
          <input
            className={fieldClass}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City or address"
            disabled={isRemote}
          />
        </Field>
        <Field label="Start date">
          <input
            type="date"
            className={fieldClass}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={isRemote}
          onChange={(e) => setIsRemote(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        Remote placement
      </label>
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create placement"}
        </button>
        <p className="text-xs text-slate-500">
          Saved as a draft — publish it from the placements list.
        </p>
      </div>
    </form>
  );
}
