"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingBlock } from "@/components/ui/LoadingSkeleton";
import {
  CURRENCY_VALIDATION_MESSAGE,
  hasValidCurrencyPrecision,
  normalizeCurrencyAmount,
} from "@/lib/validation";
import { MIN_JOB_BUDGET_GBP } from "@/lib/stripe";

export function FormSkeleton() {
  return (
    <div className="space-y-6">
      <LoadingBlock className="h-10 w-full" />
      <LoadingBlock className="h-32 w-full" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <LoadingBlock key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <LoadingBlock className="h-10 w-full" />
      <LoadingBlock className="h-10 w-40" />
      <LoadingBlock className="h-12 w-full rounded-xl" />
    </div>
  );
}
import { Loader2, AlertCircle } from "lucide-react";
import { JOB_CATEGORIES } from "@/lib/job-categories";
import { Avatar } from "@/components/ui/Avatar";
import ConfirmModal from "@/components/ConfirmModal";

type PreferredKinglancer = {
  id: string;
  fullName: string;
  serviceTags: string[];
  avatarUrl: string | null;
};

export default function PostJobForm({
  preferredKinglancer,
  onSuccess,
  organisationId,
  organisations,
}: {
  preferredKinglancer?: PreferredKinglancer | null;
  onSuccess?: () => void;
  organisationId?: string;
  organisations?: { id: string; name: string }[];
}) {
  const router = useRouter();

  // "" = personal job; an org id = that organisation owns the job.
  const [contextOrgId, setContextOrgId] = useState(organisationId ?? "");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [budget, setBudget] = useState("");
  const [workMode, setWorkMode] = useState<
    "online" | "in_person" | "hybrid" | ""
  >("");
  const [location, setLocation] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [daysOnSite, setDaysOnSite] = useState("2");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    description?: string;
    categories?: string;
    budget?: string;
    location?: string;
    scheduledAt?: string;
    endsAt?: string;
    daysOnSite?: string;
    workMode?: string;
  }>({});

  const clearFieldError = (field: keyof typeof fieldErrors) =>
    setFieldErrors((p) => ({ ...p, [field]: undefined }));

  const toggleCategory = (cat: string) =>
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );

  // Minimum deadline is tomorrow
  const minDate = new Date();
  const minDateStr = minDate.toISOString().split("T")[0];

  // The budget is the single total escrowed for the whole job.
  const totalBudget = normalizeCurrencyAmount(parseFloat(budget) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const fe: typeof fieldErrors = {};
    if (!title.trim()) fe.title = "Job title is required.";
    if (!description.trim()) fe.description = "Description is required.";
    if (categories.length === 0)
      fe.categories = "Please select at least one category.";
    if (!budget || totalBudget <= 0) fe.budget = "Please enter a valid budget.";
    else if (!hasValidCurrencyPrecision(budget))
      fe.budget = CURRENCY_VALIDATION_MESSAGE;
    else if (totalBudget < MIN_JOB_BUDGET_GBP)
      fe.budget = `Minimum total budget is £${MIN_JOB_BUDGET_GBP}.`;
    else if (totalBudget > 50000)
      fe.budget = "Maximum total budget is £50,000.";

    if (!workMode) fe.workMode = "Choose where the job happens.";
    if (workMode === "online") {
      if (!scheduledAt) fe.scheduledAt = "Add the start date.";
      if (!endsAt) fe.endsAt = "Add the end date.";
      else if (
        scheduledAt &&
        new Date(endsAt).getTime() < new Date(scheduledAt).getTime()
      )
        fe.endsAt = "The end date must be after the start date.";
    }
    if (workMode === "in_person" || workMode === "hybrid") {
      if (!location.trim()) fe.location = "Add the job location.";
    }
    if (workMode === "in_person") {
      if (!scheduledAt || !/T\d{2}:\d{2}/.test(scheduledAt))
        fe.scheduledAt = "Add the start date and time.";
      if (!endsAt || !/T\d{2}:\d{2}/.test(endsAt))
        fe.endsAt = "Add the end date and time.";
      else if (
        scheduledAt &&
        new Date(endsAt).getTime() <= new Date(scheduledAt).getTime()
      )
        fe.endsAt = "The end time must be after the start time.";
    }
    if (workMode === "hybrid") {
      const days = Number(daysOnSite);
      if (!Number.isInteger(days) || days < 1 || days > 6)
        fe.daysOnSite = "Set how many days on-site per week (1–6).";
      if (!scheduledAt) fe.scheduledAt = "Add the start date.";
      if (!endsAt) fe.endsAt = "Add the end date.";
      else if (
        scheduledAt &&
        new Date(endsAt).getTime() < new Date(scheduledAt).getTime()
      )
        fe.endsAt = "The end date must be after the start date.";
    }

    if (Object.keys(fe).length > 0) {
      setFieldErrors(fe);
      return;
    }

    // Confirm the job's owner (personal vs organisation) before posting.
    if (organisations && organisations.length > 0) {
      setConfirmOpen(true);
      return;
    }
    await doPost();
  };

  const doPost = async () => {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        categories,
        budget: totalBudget,
        rate_type: "fixed",
        invited_kinglancer_id: preferredKinglancer?.id ?? null,
        work_mode: workMode,
        location: workMode !== "online" ? location.trim() : null,
        scheduled_at: scheduledAt || null,
        ends_at: endsAt || null,
        days_on_site: workMode === "hybrid" ? Number(daysOnSite) : null,
        organisation_id: contextOrgId || null,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to post job. Please try again.");
      return;
    }

    if (onSuccess) {
      onSuccess();
    } else {
      router.push(
        contextOrgId
          ? `/dashboard/organisations/${contextOrgId}`
          : `/dashboard/client/jobs/${data.id}`,
      );
    }
  };

  const selectedOrg =
    organisations?.find((org) => org.id === contextOrgId) ?? null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => {
          if (!loading) setConfirmOpen(false);
        }}
        onConfirm={doPost}
        loading={loading}
        error={error ?? undefined}
        confirmLabel="Confirm & post"
        title={
          selectedOrg
            ? `Post this job for ${selectedOrg.name}?`
            : "Post this as your personal job?"
        }
        message={
          selectedOrg ? (
            <>
              This job will belong to <strong>{selectedOrg.name}</strong>. Any
              member of the organisation can manage it and it appears in the
              organisation workspace — not your personal jobs.
            </>
          ) : (
            <>
              This is your <strong>personal</strong> job. Only you can manage it
              and it appears under your personal My Jobs.
            </>
          )
        }
      />
      {organisations && organisations.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Who is this job for? <span className="text-red-500">*</span>
          </label>
          <select
            value={contextOrgId}
            onChange={(e) => setContextOrgId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="">Personal — your own job</option>
            {organisations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name} (organisation)
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {contextOrgId
              ? "This job belongs to the organisation — any member can manage it and it lives in the organisation workspace."
              : "This is your personal job — only you can manage it."}
          </p>
        </div>
      )}

      {preferredKinglancer && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
          <div className="flex items-start gap-3">
            <Avatar
              name={preferredKinglancer.fullName}
              src={preferredKinglancer.avatarUrl}
              tone="green"
              className="h-10 w-10"
            />
            <div>
              <p className="text-sm font-black text-slate-950">
                Sending a private request to {preferredKinglancer.fullName}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                This request is private to them. If they accept the terms, you
                will fund escrow before the job starts.
              </p>
              {preferredKinglancer.serviceTags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {preferredKinglancer.serviceTags
                    .slice(0, 3)
                    .map((service) => (
                      <span
                        key={service}
                        className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-blue-700"
                      >
                        {service}
                      </span>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Job title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            clearFieldError("title");
          }}
          maxLength={120}
          className={`w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:border-transparent text-sm transition-all ${
            fieldErrors.title
              ? "border-red-400 focus:ring-red-300"
              : "border-gray-200 focus:ring-blue-500"
          }`}
          placeholder="e.g. Need a photographer for graduation ceremony"
        />
        {fieldErrors.title && (
          <p className="text-xs text-red-500 mt-1">{fieldErrors.title}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            clearFieldError("description");
          }}
          rows={5}
          maxLength={2000}
          className={`w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:border-transparent text-sm transition-all resize-none ${
            fieldErrors.description
              ? "border-red-400 focus:ring-red-300"
              : "border-gray-200 focus:ring-blue-500"
          }`}
          placeholder="Describe exactly what you need done, where, and any important details..."
        />
        <div className="flex justify-between items-center mt-1">
          {fieldErrors.description ? (
            <p className="text-xs text-red-500">{fieldErrors.description}</p>
          ) : (
            <span />
          )}
          <p className="text-xs text-gray-400 text-right">
            {description.length}/2000
          </p>
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Category <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {JOB_CATEGORIES.map((cat) => {
            const selected = categories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  toggleCategory(cat);
                  clearFieldError("categories");
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all cursor-pointer ${
                  selected
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
        {fieldErrors.categories ? (
          <p className="text-xs text-red-500 mt-2">{fieldErrors.categories}</p>
        ) : categories.length > 0 ? (
          <p className="text-xs text-gray-400 mt-2">
            {categories.length} selected
          </p>
        ) : null}
      </div>

      {/* Work mode */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Where does this happen? <span className="text-red-500">*</span>
        </label>
        <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs font-medium">
          {(
            [
              { value: "online", label: "Online / remote" },
              { value: "hybrid", label: "Hybrid" },
              { value: "in_person", label: "In person" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setWorkMode(opt.value)}
              className={`flex-1 py-2 transition-colors ${
                workMode === opt.value
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {fieldErrors.workMode && (
          <p className="text-xs text-red-500 mt-2">{fieldErrors.workMode}</p>
        )}
      </div>

      {(workMode === "in_person" || workMode === "hybrid") && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Location <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              clearFieldError("location");
            }}
            maxLength={200}
            className={`w-full rounded-xl border px-4 py-2.5 text-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 ${
              fieldErrors.location
                ? "border-red-400 focus:ring-red-300"
                : "border-gray-200 focus:ring-blue-500"
            }`}
            placeholder="Address or area where the work happens"
          />
          {fieldErrors.location && (
            <p className="mt-1 text-xs text-red-500">{fieldErrors.location}</p>
          )}
        </div>
      )}

      {workMode === "hybrid" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Days on-site per week (max 6){" "}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={1}
            max={6}
            value={daysOnSite}
            onChange={(e) => {
              setDaysOnSite(e.target.value);
              clearFieldError("daysOnSite");
            }}
            className={`w-full rounded-xl border px-4 py-2.5 text-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 ${
              fieldErrors.daysOnSite
                ? "border-red-400 focus:ring-red-300"
                : "border-gray-200 focus:ring-blue-500"
            }`}
          />
          {fieldErrors.daysOnSite && (
            <p className="mt-1 text-xs text-red-500">
              {fieldErrors.daysOnSite}
            </p>
          )}
        </div>
      )}

      {workMode && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {workMode === "in_person" ? "Starts" : "Start date"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type={workMode === "in_person" ? "datetime-local" : "date"}
              value={scheduledAt}
              min={workMode === "in_person" ? undefined : minDateStr}
              onChange={(e) => {
                setScheduledAt(e.target.value);
                clearFieldError("scheduledAt");
              }}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 ${
                fieldErrors.scheduledAt
                  ? "border-red-400 focus:ring-red-300"
                  : "border-gray-200 focus:ring-blue-500"
              }`}
            />
            {fieldErrors.scheduledAt && (
              <p className="mt-1 text-xs text-red-500">
                {fieldErrors.scheduledAt}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {workMode === "in_person" ? "Ends" : "End date"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type={workMode === "in_person" ? "datetime-local" : "date"}
              value={endsAt}
              min={scheduledAt || undefined}
              onChange={(e) => {
                setEndsAt(e.target.value);
                clearFieldError("endsAt");
              }}
              className={`w-full rounded-xl border px-4 py-2.5 text-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 ${
                fieldErrors.endsAt
                  ? "border-red-400 focus:ring-red-300"
                  : "border-gray-200 focus:ring-blue-500"
              }`}
            />
            {fieldErrors.endsAt && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.endsAt}</p>
            )}
          </div>
        </div>
      )}

      {/* Budget */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Total budget (£) <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
            £
          </span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={budget}
            onChange={(e) => {
              setBudget(e.target.value);
              clearFieldError("budget");
            }}
            className={`w-full pl-8 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:border-transparent text-sm transition-all ${
              fieldErrors.budget
                ? "border-red-400 focus:ring-red-300"
                : "border-gray-200 focus:ring-blue-500"
            }`}
            placeholder="0"
          />
        </div>
        {fieldErrors.budget ? (
          <p className="text-xs text-red-500 mt-1">{fieldErrors.budget}</p>
        ) : (
          <p className="text-xs text-gray-400 mt-1">
            The total price for the whole job — held in escrow once you select a
            Kinglancer.
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Escrow notice */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
        {preferredKinglancer ? (
          <>
            <strong>How payment works:</strong> Your budget is held in escrow
            once {preferredKinglancer.fullName.split(" ")[0]} accepts your
            request. Released only when you approve the completed work.
          </>
        ) : (
          <>
            <strong>How payment works:</strong> Your budget is only charged when
            you select a kinglancer. It is held securely in escrow until you
            approve the completed work.
          </>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all hover:scale-[1.01] shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            {preferredKinglancer ? "Sending..." : "Posting job..."}
          </>
        ) : preferredKinglancer ? (
          "Send Request"
        ) : (
          "Post job"
        )}
      </button>
    </form>
  );
}
