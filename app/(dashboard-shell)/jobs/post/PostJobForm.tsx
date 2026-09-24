"use client";

import { JOB_ATTACHMENT_ACCEPT, jobAttachmentError } from "@/lib/job-attachments";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingBlock } from "@/components/ui/LoadingSkeleton";
import {
  CURRENCY_VALIDATION_MESSAGE,
  hasValidCurrencyPrecision,
  normalizeCurrencyAmount,
} from "@/lib/validation";
import { MIN_JOB_BUDGET_GBP } from "@/lib/stripe";
import ScheduleTypeField from "@/components/jobs/ScheduleTypeField";
import LocationField from "@/components/jobs/LocationField";

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
  organisationName,
  attachmentOrganisationIds = [],
}: {
  preferredKinglancer?: PreferredKinglancer | null;
  onSuccess?: () => void;
  organisationId?: string;
  organisationName?: string;
  attachmentOrganisationIds?: string[];
}) {
  const router = useRouter();

  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const canAttach = attachmentOrganisationIds.includes(organisationId ?? "");

  // Roles are org-only; a direct request to a specific Kinglancer is always a gig.
  const canPostRole = !!organisationId && !preferredKinglancer;
  const [postingType, setPostingType] = useState<"gig" | "role">("gig");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [budget, setBudget] = useState("");
  const [workMode, setWorkMode] = useState<
    "online" | "in_person" | "hybrid" | ""
  >("");
  const [addressLine, setAddressLine] = useState("");
  const [postcode, setPostcode] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [daysOnSite, setDaysOnSite] = useState("2");
  const [scheduleType, setScheduleType] = useState<"shift" | "window">(
    "window",
  );
  const [estimatedMinutes, setEstimatedMinutes] = useState("");

  // Role-only fields
  const [employmentType, setEmploymentType] = useState<
    "permanent" | "temporary"
  >("permanent");
  const [roleStartsAt, setRoleStartsAt] = useState("");
  const [roleEndsAt, setRoleEndsAt] = useState("");
  const [payCadence, setPayCadence] = useState<"weekly" | "monthly">(
    "monthly",
  );
  const [payAmount, setPayAmount] = useState("");
  const [payNegotiable, setPayNegotiable] = useState(false);
  const [settlementMode, setSettlementMode] = useState<"managed" | "direct">(
    "managed",
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    description?: string;
    categories?: string;
    budget?: string;
    address?: string;
    postcode?: string;
    scheduledAt?: string;
    endsAt?: string;
    daysOnSite?: string;
    workMode?: string;
    employmentType?: string;
    payAmount?: string;
    settlementMode?: string;
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
    const isRole = canPostRole && postingType === "role";

    const fe: typeof fieldErrors = {};
    if (!title.trim()) fe.title = "Job title is required.";
    if (!description.trim()) fe.description = "Description is required.";
    if (categories.length === 0)
      fe.categories = "Please select at least one category.";

    if (!isRole) {
      if (!budget || totalBudget <= 0)
        fe.budget = "Please enter a valid budget.";
      else if (!hasValidCurrencyPrecision(budget))
        fe.budget = CURRENCY_VALIDATION_MESSAGE;
      else if (totalBudget < MIN_JOB_BUDGET_GBP)
        fe.budget = `Minimum total budget is £${MIN_JOB_BUDGET_GBP}.`;
      else if (totalBudget > 50000)
        fe.budget = "Maximum total budget is £50,000.";
    } else {
      if (!payNegotiable) {
        const amount = Number(payAmount);
        if (!Number.isFinite(amount) || amount < MIN_JOB_BUDGET_GBP)
          fe.payAmount = `The recurring pay must be at least £${MIN_JOB_BUDGET_GBP} per period.`;
      }
      if (employmentType === "temporary") {
        if (!roleStartsAt) fe.scheduledAt = "Add the start date.";
        if (!roleEndsAt) fe.endsAt = "Add the end date.";
        else if (
          roleStartsAt &&
          new Date(roleEndsAt).getTime() < new Date(roleStartsAt).getTime()
        )
          fe.endsAt = "The end date must be after the start date.";
      }
    }

    if (!workMode) fe.workMode = "Choose where the job happens.";
    if (!isRole && workMode === "online") {
      if (!scheduledAt) fe.scheduledAt = "Add the start date.";
      if (!endsAt) fe.endsAt = "Add the end date.";
      else if (
        scheduledAt &&
        new Date(endsAt).getTime() < new Date(scheduledAt).getTime()
      )
        fe.endsAt = "The end date must be after the start date.";
    }
    if (workMode === "in_person" || workMode === "hybrid") {
      if (!addressLine.trim()) fe.address = "Add the street address.";
      if (!postcode.trim()) fe.postcode = "Add the postcode.";
    }
    if (!isRole && workMode === "in_person") {
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
      if (!isRole) {
        if (!scheduledAt) fe.scheduledAt = "Add the start date.";
        if (!endsAt) fe.endsAt = "Add the end date.";
        else if (
          scheduledAt &&
          new Date(endsAt).getTime() < new Date(scheduledAt).getTime()
        )
          fe.endsAt = "The end date must be after the start date.";
      }
    }

    if (Object.keys(fe).length > 0) {
      setFieldErrors(fe);
      return;
    }

    if (attachmentError) return;

    await doPost();
  };

  const doPost = async () => {
    setLoading(true);
    setError(null);
    const isRole = canPostRole && postingType === "role";

    try {
      const payload = JSON.stringify({
        title,
        description,
        categories,
        posting_type: isRole ? "role" : "gig",
        ...(isRole
          ? {
              employment_type: employmentType,
              pay_cadence: payNegotiable ? null : payCadence,
              pay_amount: payNegotiable ? null : Number(payAmount),
              pay_negotiable: payNegotiable,
              settlement_mode: payNegotiable ? "direct" : settlementMode,
              scheduled_at:
                employmentType === "temporary" ? roleStartsAt : null,
              ends_at: employmentType === "temporary" ? roleEndsAt : null,
            }
          : {
              budget: totalBudget,
              rate_type: "fixed",
              invited_kinglancer_id: preferredKinglancer?.id ?? null,
              scheduled_at: scheduledAt || null,
              ends_at: endsAt || null,
              schedule_type: workMode === "in_person" ? scheduleType : "window",
              estimated_minutes:
                workMode === "in_person" &&
                scheduleType === "window" &&
                estimatedMinutes
                  ? Number(estimatedMinutes)
                  : null,
            }),
        work_mode: workMode,
        address_line: workMode !== "online" ? addressLine.trim() : null,
        postcode: workMode !== "online" ? postcode.trim() : null,
        days_on_site: workMode === "hybrid" ? Number(daysOnSite) : null,
        organisation_id: organisationId || null,
      });
      const form = new FormData();
      form.set("job", payload);
      if (canAttach && attachmentFile) form.set("attachment", attachmentFile);
      const res = await fetch("/api/jobs", {
        method: "POST",
        ...(canAttach && attachmentFile
          ? { body: form }
          : { headers: { "Content-Type": "application/json" }, body: payload }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to post job. Please try again.");
        return;
      }

      if (onSuccess) {
        onSuccess();
      } else if (isRole) {
        router.push(`/dashboard/organisations/${organisationId}/jobs`);
      } else {
        router.push(
          organisationId
            ? `/dashboard/organisations/${organisationId}`
            : `/dashboard/client/jobs/${data.id}`,
        );
      }
    } catch {
      setError("Unable to post your job. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const isRolePosting = canPostRole && postingType === "role";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h3 className="border-b-2 border-gray-300 pb-1.5 text-sm font-bold text-gray-900">
        Job details
      </h3>
      <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-900">
        {organisationId ? (
          <>
            Posting for <strong>{organisationName ?? "your organisation"}</strong> —
            any member can manage it and it lives in the organisation workspace.
          </>
        ) : (
          <>
            Posting as your <strong>personal</strong> job — only you can manage
            it.
          </>
        )}
      </div>

      {canPostRole && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            What kind of job is this? <span className="text-red-500">*</span>
          </label>
          <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs font-medium">
            {(
              [
                { value: "gig", label: "One-off gig" },
                { value: "role", label: "Recurring role" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPostingType(opt.value)}
                className={`flex-1 py-2 transition-colors ${
                  postingType === opt.value
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {postingType === "role"
              ? "An ongoing position with recurring pay — permanent or temporary."
              : "A single paid task, escrowed for the full amount."}
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
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description <span className="text-red-500">*</span>
        </label>
        <p className="mb-1.5 text-xs text-gray-400">
          Focus on the task itself — you&apos;ll set location, timing and budget
          below.
        </p>
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
          placeholder="Describe the task itself — what needs doing and to what standard (e.g. clean a 3-bed flat to Airbnb turnover standard, bring supplies)."
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

      {canAttach && (
        <div>
          <label htmlFor="job-attachment" className="mb-1.5 block text-sm font-medium text-gray-700">
            Job description document <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <p id="job-attachment-help" className="mb-2 text-xs text-gray-500">
            Upload the full job description, including responsibilities and requirements. PDF, Word or text, up to 3 MB. PDF is best for viewing in a browser.
            Kinglancers and your Organisation can open it from the job details page. Anyone who can view the job can view this document.
          </p>
          <input
            key={`${organisationId ?? "personal"}-${attachmentFile ? "selected" : "empty"}`}
            id="job-attachment"
            type="file"
            accept={JOB_ATTACHMENT_ACCEPT}
            disabled={loading}
            aria-describedby="job-attachment-help"
            aria-invalid={!!attachmentError}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              const message = file ? jobAttachmentError(file) : null;
              setAttachmentError(message);
              setAttachmentFile(message ? null : file);
              if (message) e.target.value = "";
            }}
            className="block w-full rounded-xl border border-gray-200 p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700"
          />
          {attachmentFile && (
            <p className="mt-2 break-words text-sm text-gray-600">
              {attachmentFile.name}{" "}
              <button type="button" disabled={loading} className="font-semibold text-blue-700" onClick={() => { setAttachmentFile(null); setAttachmentError(null); }}>Remove</button>
            </p>
          )}
          {attachmentError && <p role="alert" className="mt-1 text-xs text-red-500">{attachmentError}</p>}
        </div>
      )}

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

      <h3 className="border-b-2 border-gray-300 pb-1.5 text-sm font-bold text-gray-900">
        Where &amp; when
      </h3>
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
        <LocationField
          addressLine={addressLine}
          postcode={postcode}
          onAddressLineChange={(v) => {
            setAddressLine(v);
            clearFieldError("address");
          }}
          onPostcodeChange={(v) => {
            setPostcode(v);
            clearFieldError("postcode");
          }}
          errorAddress={fieldErrors.address}
          errorPostcode={fieldErrors.postcode}
        />
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

      {!(canPostRole && postingType === "role") && workMode === "in_person" && (
        <ScheduleTypeField
          scheduleType={scheduleType}
          onScheduleTypeChange={setScheduleType}
          estimatedMinutes={estimatedMinutes}
          onEstimatedMinutesChange={setEstimatedMinutes}
        />
      )}

      {!isRolePosting && workMode && (
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

      {isRolePosting && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Role type <span className="text-red-500">*</span>
          </label>
          <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs font-medium">
            {(
              [
                { value: "permanent", label: "Permanent" },
                { value: "temporary", label: "Temporary" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setEmploymentType(opt.value)}
                className={`flex-1 py-2 transition-colors ${
                  employmentType === opt.value
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {isRolePosting && employmentType === "temporary" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Start date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={roleStartsAt}
              min={minDateStr}
              onChange={(e) => {
                setRoleStartsAt(e.target.value);
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
              End date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={roleEndsAt}
              min={roleStartsAt || undefined}
              onChange={(e) => {
                setRoleEndsAt(e.target.value);
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

      {isRolePosting ? (
        <>
          <h3 className="border-b-2 border-gray-300 pb-1.5 text-sm font-bold text-gray-900">
            Pay
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">
              Pay arrangement
              <select
                value={payNegotiable ? "discuss" : "set"}
                onChange={(e) => setPayNegotiable(e.target.value === "discuss")}
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              >
                <option value="set">Set recurring pay</option>
                <option value="discuss">Discuss at interview</option>
              </select>
            </label>
            {!payNegotiable && (
              <label className="text-sm font-medium text-gray-700">
                Pay cadence
                <select
                  value={payCadence}
                  onChange={(e) =>
                    setPayCadence(e.target.value as "weekly" | "monthly")
                  }
                  className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>
            )}
          </div>
          {!payNegotiable && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Pay per period (£) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={MIN_JOB_BUDGET_GBP}
                step="0.01"
                value={payAmount}
                onChange={(e) => {
                  setPayAmount(e.target.value);
                  clearFieldError("payAmount");
                }}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 ${
                  fieldErrors.payAmount
                    ? "border-red-400 focus:ring-red-300"
                    : "border-gray-200 focus:ring-blue-500"
                }`}
              />
              {fieldErrors.payAmount && (
                <p className="mt-1 text-xs text-red-500">
                  {fieldErrors.payAmount}
                </p>
              )}
            </div>
          )}
          {!payNegotiable && (
            <label className="block text-sm font-medium text-gray-700">
              Payment handling
              <select
                value={settlementMode}
                onChange={(e) =>
                  setSettlementMode(e.target.value as "managed" | "direct")
                }
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              >
                <option value="managed">
                  KingsHire-managed escrow and payout
                </option>
                <option value="direct">
                  Organisation pays the Kinglancer directly
                </option>
              </select>
            </label>
          )}
        </>
      ) : (
        <>
          <h3 className="border-b-2 border-gray-300 pb-1.5 text-sm font-bold text-gray-900">
            Budget
          </h3>
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
        </>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Payment notice */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
        {isRolePosting ? (
          <>
            <strong>How payment works:</strong> Once you hire someone, their
            recurring pay is either KingsHire-managed (charged and held in
            escrow each period) or paid by your Organisation directly,
            depending on what you choose above.
          </>
        ) : preferredKinglancer ? (
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
            {preferredKinglancer
              ? "Sending..."
              : isRolePosting
                ? "Posting role..."
                : "Posting job..."}
          </>
        ) : preferredKinglancer ? (
          "Send Request"
        ) : isRolePosting ? (
          "Post role"
        ) : (
          "Post job"
        )}
      </button>
    </form>
  );
}
