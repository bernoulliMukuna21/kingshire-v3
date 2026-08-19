"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_PLACEMENT_DURATION_WEEKS } from "@/lib/placements";

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500";

const WORK_MODES = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
] as const;

const COMPENSATION_OPTIONS = [
  { value: "money", label: "Money" },
  { value: "reference", label: "Reference" },
  { value: "certificate", label: "Certificate" },
  { value: "mentoring", label: "Mentoring" },
  { value: "training", label: "Training" },
  { value: "other", label: "Other" },
] as const;

type WorkMode = (typeof WORK_MODES)[number]["value"];

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
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
  const [workMode, setWorkMode] = useState<WorkMode>("remote");
  const [daysOnSite, setDaysOnSite] = useState("2");
  const [location, setLocation] = useState("");
  const [compensation, setCompensation] = useState<string[]>([]);
  const [compensationNote, setCompensationNote] = useState("");
  const [weeklyHours, setWeeklyHours] = useState("8");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsLocation = workMode === "hybrid" || workMode === "onsite";

  function toggleCategory(c: string) {
    setSelected((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  function toggleCompensation(value: string) {
    setCompensation((prev) =>
      prev.includes(value)
        ? prev.filter((x) => x !== value)
        : [...prev, value],
    );
  }

  function validate(): string | null {
    if (title.trim().length < 3) return "Add a title (at least 3 characters).";
    if (summary.trim().length < 10)
      return "Add a summary (at least 10 characters).";
    if (!selected.length) return "Select at least one category.";
    if (contribution.trim().length < 10)
      return "Describe what the participant will contribute.";
    if (needsLocation && !location.trim())
      return "Add a location for on-site or hybrid placements.";
    if (workMode === "hybrid") {
      const days = Number(daysOnSite);
      if (!Number.isInteger(days) || days < 1 || days > 6)
        return "Set how many days on-site per week (1–6).";
    }
    if (!startDate) return "Add a start date.";
    if (!endDate) return "Add an end date.";
    const weeks = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    );
    if (weeks < 1) return "The end date must be after the start date.";
    if (weeks > MAX_PLACEMENT_DURATION_WEEKS)
      return "A placement can run for at most 6 months.";
    if (compensation.includes("other") && compensationNote.trim().length < 3)
      return "Explain what the 'Other' compensation is.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
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
          location: needsLocation ? location.trim() || null : null,
          work_mode: workMode,
          days_on_site: workMode === "hybrid" ? Number(daysOnSite) : null,
          compensation_types: compensation,
          compensation_note: compensationNote.trim() || null,
          weekly_hours: Number(weeklyHours),
          start_date: startDate,
          end_date: endDate,
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
      <Field label="Title" required>
        <input
          className={fieldClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={140}
          placeholder="e.g. Media team assistant placement"
        />
      </Field>
      <Field label="Summary" required>
        <textarea
          className={`${fieldClass} resize-none`}
          rows={3}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          maxLength={4000}
          placeholder="What the placement is about."
        />
      </Field>
      <Field label="Categories" required>
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
      <Field label="What the participant will contribute" required>
        <textarea
          className={`${fieldClass} resize-none`}
          rows={3}
          value={contribution}
          onChange={(e) => setContribution(e.target.value)}
          maxLength={4000}
          placeholder="The work or activities they'll take part in."
        />
      </Field>

      <Field label="Compensation">
        <div className="flex flex-wrap gap-2">
          {COMPENSATION_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.value}
              onClick={() => toggleCompensation(option.value)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                compensation.includes(option.value)
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Field>
      {compensation.includes("other") && (
        <Field label="Please specify the other compensation" required>
          <input
            className={fieldClass}
            value={compensationNote}
            onChange={(e) => setCompensationNote(e.target.value)}
            maxLength={2000}
            placeholder="e.g. Travel allowance of £30/week"
          />
        </Field>
      )}

      <Field label="Where is the placement carried out?" required>
        <div className="flex flex-wrap gap-2">
          {WORK_MODES.map((mode) => (
            <button
              type="button"
              key={mode.value}
              onClick={() => setWorkMode(mode.value)}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                workMode === mode.value
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        {workMode === "hybrid" && (
          <Field label="Days on-site per week (max 6)" required>
            <input
              type="number"
              min={1}
              max={6}
              className={fieldClass}
              value={daysOnSite}
              onChange={(e) => setDaysOnSite(e.target.value)}
            />
          </Field>
        )}
        {needsLocation && (
          <Field label="Location" required>
            <input
              className={fieldClass}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City or address"
            />
          </Field>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Weekly hours (max 16)" required>
          <input
            type="number"
            min={1}
            max={16}
            className={fieldClass}
            value={weeklyHours}
            onChange={(e) => setWeeklyHours(e.target.value)}
          />
        </Field>
        <Field label="Start date" required>
          <input
            type="date"
            className={fieldClass}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        <Field label="End date" required>
          <input
            type="date"
            className={fieldClass}
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </Field>
      </div>
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
