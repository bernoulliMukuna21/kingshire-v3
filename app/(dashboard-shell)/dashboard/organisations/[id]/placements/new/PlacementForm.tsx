"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MAX_PLACEMENT_DURATION_WEEKS,
  COMPENSATION_LABELS,
  PLACEMENT_COMPENSATION_CADENCES,
  COMPENSATION_CADENCE_LABELS,
} from "@/lib/placements";

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

const DETAIL_PLACEHOLDERS: Record<string, string> = {
  reference: "Who provides it and in what form?",
  certificate: "What it certifies and any accreditation.",
  mentoring: "What mentoring, how often, and by whom.",
  training: "What training the participant will receive.",
  other: "Describe the other compensation.",
};

type WorkMode = (typeof WORK_MODES)[number]["value"];

export type PlacementFormInitial = {
  title: string;
  summary: string;
  categories: string[];
  contribution: string;
  workMode: WorkMode;
  daysOnSite: string;
  location: string;
  compensation: string[];
  moneyAmount: string;
  moneyCadence: string;
  compDetails: Record<string, string>;
  weeklyHours: string;
  paymentMode: "managed" | "direct";
};

function Field({
  label,
  required,
  id,
  children,
}: {
  label: string;
  required?: boolean;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-24">
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
  initial,
}: {
  organisationId: string;
  categories: string[];
  initial?: PlacementFormInitial;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [selected, setSelected] = useState<string[]>(initial?.categories ?? []);
  const [contribution, setContribution] = useState(initial?.contribution ?? "");
  const [workMode, setWorkMode] = useState<WorkMode>(
    initial?.workMode ?? "remote",
  );
  const [daysOnSite, setDaysOnSite] = useState(initial?.daysOnSite ?? "2");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [compensation, setCompensation] = useState<string[]>(
    initial?.compensation ?? [],
  );
  const [moneyAmount, setMoneyAmount] = useState(initial?.moneyAmount ?? "");
  const [moneyCadence, setMoneyCadence] = useState(
    initial?.moneyCadence ?? "per_month",
  );
  const [compDetails, setCompDetails] = useState<Record<string, string>>(
    initial?.compDetails ?? {},
  );
  const [weeklyHours, setWeeklyHours] = useState(initial?.weeklyHours ?? "8");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | null>(null);

  const needsLocation = workMode === "hybrid" || workMode === "onsite";

  // Red border on the field flagged by validation.
  const inputClass = (name: string) =>
    `w-full rounded-xl bg-white px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      errorField === name
        ? "border-red-400 ring-2 ring-red-200"
        : "border-slate-200 focus:border-transparent"
    }`;

  function toggleCategory(c: string) {
    setSelected((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  function toggleCompensation(value: string) {
    setCompensation((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value],
    );
  }

  function setDetail(type: string, value: string) {
    setCompDetails((prev) => ({ ...prev, [type]: value }));
  }

  function buildCompensationDetails() {
    const details: Record<string, unknown> = {};
    if (compensation.includes("money"))
      details.money = { amount: Number(moneyAmount), cadence: moneyCadence };
    for (const type of compensation) {
      if (type === "money") continue;
      details[type] = (compDetails[type] ?? "").trim();
    }
    return details;
  }

  function validate(): { field: string; message: string } | null {
    if (title.trim().length < 3)
      return {
        field: "title",
        message: "Add a title (at least 3 characters).",
      };
    if (summary.trim().length < 10)
      return {
        field: "summary",
        message: "Add a summary (at least 10 characters).",
      };
    if (!selected.length)
      return { field: "categories", message: "Select at least one category." };
    if (contribution.trim().length < 10)
      return {
        field: "contribution",
        message: "Describe what the participant will contribute.",
      };
    if (!compensation.length)
      return {
        field: "compensation",
        message:
          "Offer the participant at least one thing in return (money, a reference, training, etc.).",
      };
    if (needsLocation && !location.trim())
      return {
        field: "location",
        message: "Add a location for on-site or hybrid placements.",
      };
    if (workMode === "hybrid") {
      const days = Number(daysOnSite);
      if (!Number.isInteger(days) || days < 1 || days > 6)
        return {
          field: "daysOnSite",
          message: "Set how many days on-site per week (1–6).",
        };
    }
    if (!startDate) return { field: "startDate", message: "Add a start date." };
    if (!endDate) return { field: "endDate", message: "Add an end date." };
    const weeks = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    );
    if (weeks < 1)
      return {
        field: "endDate",
        message: "The end date must be after the start date.",
      };
    if (weeks > MAX_PLACEMENT_DURATION_WEEKS)
      return {
        field: "endDate",
        message: "A placement can run for at most 6 months.",
      };
    if (compensation.includes("money") && !(Number(moneyAmount) > 0))
      return {
        field: "moneyAmount",
        message: "Enter the amount for the money compensation.",
      };
    for (const type of compensation) {
      if (type === "money") continue;
      if ((compDetails[type] ?? "").trim().length < 3)
        return {
          field: `detail-${type}`,
          message: `Add details for the ${COMPENSATION_LABELS[type]} compensation.`,
        };
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError.message);
      setErrorField(validationError.field);
      requestAnimationFrame(() =>
        document
          .getElementById(validationError.field)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      );
      return;
    }
    setSaving(true);
    setError(null);
    setErrorField(null);
    const res = await fetch(`/api/organisations/${organisationId}/placements`, {
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
        compensation_details: buildCompensationDetails(),
        payment_mode: compensation.includes("money") ? "managed" : "direct",
        weekly_hours: Number(weeklyHours),
        start_date: startDate,
        end_date: endDate,
      }),
    });
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
      <Field label="Title" required id="title">
        <input
          className={inputClass("title")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={140}
          placeholder="e.g. Media team assistant placement"
        />
      </Field>
      <Field label="Summary" required id="summary">
        <textarea
          className={`${inputClass("summary")} resize-none`}
          rows={3}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          maxLength={4000}
          placeholder="What the placement is about."
        />
      </Field>
      <Field label="Categories" required id="categories">
        <div
          className={`flex flex-wrap gap-2 ${
            errorField === "categories"
              ? "rounded-xl p-2 ring-2 ring-red-200"
              : ""
          }`}
        >
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
      <Field
        label="What the participant will contribute"
        required
        id="contribution"
      >
        <textarea
          className={`${inputClass("contribution")} resize-none`}
          rows={3}
          value={contribution}
          onChange={(e) => setContribution(e.target.value)}
          maxLength={4000}
          placeholder="The work or activities they'll take part in."
        />
      </Field>

      <Field
        label="What the participant gets in return"
        required
        id="compensation"
      >
        <div
          className={`flex flex-wrap gap-2 ${
            errorField === "compensation"
              ? "rounded-xl p-2 ring-2 ring-red-200"
              : ""
          }`}
        >
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
      {compensation.includes("money") && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount (£)" required id="moneyAmount">
            <input
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              className={inputClass("moneyAmount")}
              value={moneyAmount}
              onChange={(e) => setMoneyAmount(e.target.value)}
              placeholder="e.g. 30"
            />
          </Field>
          <Field label="How often" required>
            <select
              className={fieldClass}
              value={moneyCadence}
              onChange={(e) => setMoneyCadence(e.target.value)}
            >
              {PLACEMENT_COMPENSATION_CADENCES.map((cadence) => (
                <option key={cadence} value={cadence}>
                  {COMPENSATION_CADENCE_LABELS[cadence]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
      {compensation.includes("money") && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-slate-700">
          <span className="font-bold text-slate-900">
            Managed by KingsHire.
          </span>{" "}
          Paid placements are handled by KingsHire — we collect from your
          organisation and pay the Kinglancer each month. Platform fees apply.
        </div>
      )}
      {compensation
        .filter((type) => type !== "money")
        .map((type) => (
          <Field
            key={type}
            label={`${COMPENSATION_LABELS[type]} details`}
            required
            id={`detail-${type}`}
          >
            <input
              className={inputClass(`detail-${type}`)}
              value={compDetails[type] ?? ""}
              onChange={(e) => setDetail(type, e.target.value)}
              maxLength={500}
              placeholder={DETAIL_PLACEHOLDERS[type]}
            />
          </Field>
        ))}

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
          <Field label="Days on-site per week (max 6)" required id="daysOnSite">
            <input
              type="number"
              min={1}
              max={6}
              className={inputClass("daysOnSite")}
              value={daysOnSite}
              onChange={(e) => setDaysOnSite(e.target.value)}
            />
          </Field>
        )}
        {needsLocation && (
          <Field label="Location" required id="location">
            <input
              className={inputClass("location")}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City or address"
            />
          </Field>
        )}
      </div>

      <Field label="Weekly hours (max 20)" required>
        <input
          type="number"
          min={1}
          max={20}
          className={fieldClass}
          value={weeklyHours}
          onChange={(e) => setWeeklyHours(e.target.value)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start date" required id="startDate">
          <input
            type="date"
            className={inputClass("startDate")}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Field>
        <Field label="End date" required id="endDate">
          <input
            type="date"
            className={inputClass("endDate")}
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
          {saving ? "Submitting…" : "Submit placement"}
        </button>
        <p className="text-xs text-slate-500">
          Placements are reviewed before they go live.
        </p>
      </div>
    </form>
  );
}
