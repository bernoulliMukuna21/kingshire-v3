"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingBlock } from "@/components/ui/LoadingSkeleton";
import { normalizeCurrencyAmount } from "@/lib/validation";
import { MIN_JOB_BUDGET_GBP } from "@/lib/stripe";
import ScheduleTypeField from "@/components/jobs/ScheduleTypeField";
import LocationField from "@/components/jobs/LocationField";
import { Loader2, AlertCircle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { AttachmentField } from "./AttachmentField";
import { CategoryPicker } from "./CategoryPicker";
import { BudgetField } from "./BudgetField";
import {
  validatePostJobForm,
  buildJobPostPayload,
  type PostJobFieldErrors,
} from "./postJobLogic";

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
  const [payCadence, setPayCadence] = useState<"weekly" | "monthly">("monthly");
  const [payAmount, setPayAmount] = useState("");
  const [payNegotiable, setPayNegotiable] = useState(false);
  const [settlementMode, setSettlementMode] = useState<"managed" | "direct">(
    "managed",
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<PostJobFieldErrors>({});

  const clearFieldError = (field: keyof PostJobFieldErrors) =>
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

    const fe = validatePostJobForm({
      isRole,
      title,
      description,
      categories,
      budget,
      totalBudget,
      payNegotiable,
      payAmount,
      employmentType,
      roleStartsAt,
      roleEndsAt,
      workMode,
      scheduledAt,
      endsAt,
      addressLine,
      postcode,
      daysOnSite,
    });

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
      const payload = JSON.stringify(
        buildJobPostPayload({
          title,
          description,
          categories,
          isRole,
          employmentType,
          payCadence,
          payAmount,
          payNegotiable,
          settlementMode,
          roleStartsAt,
          roleEndsAt,
          totalBudget,
          preferredKinglancerId: preferredKinglancer?.id,
          scheduledAt,
          endsAt,
          workMode,
          scheduleType,
          estimatedMinutes,
          addressLine,
          postcode,
          daysOnSite,
          organisationId,
        }),
      );
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
            Posting for{" "}
            <strong>{organisationName ?? "your organisation"}</strong> — any
            member can manage it and it lives in the organisation workspace.
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
          Job summary <span className="text-red-500">*</span>
        </label>
        <p className="mb-1.5 text-xs text-gray-400">
          {canAttach
            ? "A short overview is enough — attach the full job description as a document below."
            : "Focus on the task itself — you'll set location, timing and budget below."}
        </p>
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            clearFieldError("description");
          }}
          rows={4}
          maxLength={500}
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
            {description.length}/500
          </p>
        </div>
      </div>

      {canAttach && (
        <AttachmentField
          organisationId={organisationId}
          attachmentFile={attachmentFile}
          setAttachmentFile={setAttachmentFile}
          attachmentError={attachmentError}
          setAttachmentError={setAttachmentError}
          loading={loading}
        />
      )}

      <CategoryPicker
        categories={categories}
        onToggle={(cat) => {
          toggleCategory(cat);
          clearFieldError("categories");
        }}
        error={fieldErrors.categories}
      />

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
        <BudgetField
          budget={budget}
          onChange={(v) => {
            setBudget(v);
            clearFieldError("budget");
          }}
          error={fieldErrors.budget}
        />
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
            escrow each period) or paid by your Organisation directly, depending
            on what you choose above.
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
