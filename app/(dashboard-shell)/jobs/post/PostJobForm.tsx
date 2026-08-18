"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingBlock } from "@/components/ui/LoadingSkeleton";
import {
  CURRENCY_VALIDATION_MESSAGE,
  hasValidCurrencyPrecision,
  normalizeCurrencyAmount,
} from "@/lib/validation";

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
}: {
  preferredKinglancer?: PreferredKinglancer | null;
  onSuccess?: () => void;
  organisationId?: string;
}) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [budget, setBudget] = useState("");
  const [quantity, setQuantity] = useState("");
  const [rateType, setRateType] = useState<"fixed" | "per_hour" | "per_day">(
    "fixed",
  );
  const [deadline, setDeadline] = useState("");
  const [workMode, setWorkMode] = useState<"online" | "in_person">("online");
  const [location, setLocation] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    description?: string;
    categories?: string;
    budget?: string;
    quantity?: string;
    location?: string;
    scheduledAt?: string;
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

  // For per_hour / per_day, the total escrowed = rate × quantity
  const rate = parseFloat(budget) || 0;
  const qty = parseFloat(quantity) || 0;
  const totalBudget = normalizeCurrencyAmount(
    rateType === "fixed" ? rate : rate * qty,
  );
  const formattedTotalBudget = totalBudget.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const fe: typeof fieldErrors = {};
    if (!title.trim()) fe.title = "Job title is required.";
    if (!description.trim()) fe.description = "Description is required.";
    if (categories.length === 0)
      fe.categories = "Please select at least one category.";
    if (!budget || rate <= 0) fe.budget = "Please enter a valid budget.";
    else if (!hasValidCurrencyPrecision(budget))
      fe.budget = CURRENCY_VALIDATION_MESSAGE;
    else if (rateType !== "fixed" && (!quantity || qty <= 0))
      fe.quantity = `Please enter how many ${rateType === "per_hour" ? "hours" : "days"} you expect the work to take.`;
    else if (totalBudget < 5) fe.budget = "Minimum total budget is £5.";
    else if (totalBudget > 50000)
      fe.budget = "Maximum total budget is £50,000.";

    if (workMode === "in_person") {
      if (!location.trim()) fe.location = "Add the job location.";
      if (!scheduledAt)
        fe.scheduledAt = "Add the date and time of attendance.";
    }

    if (Object.keys(fe).length > 0) {
      setFieldErrors(fe);
      return;
    }

    setLoading(true);

    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        categories,
        budget: totalBudget,
        rate_type: rateType,
        invited_kinglancer_id: preferredKinglancer?.id ?? null,
        deadline: deadline || null,
        work_mode: workMode,
        location: workMode === "in_person" ? location.trim() : null,
        scheduled_at:
          workMode === "in_person" && scheduledAt ? scheduledAt : null,
        organisation_id: organisationId ?? null,
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
        organisationId
          ? `/dashboard/organisations/${organisationId}`
          : `/dashboard/client/jobs/${data.id}`,
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      {/* Budget */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Budget (£) <span className="text-red-500">*</span>
        </label>
        {/* Rate type segmented toggle */}
        {/* Rate type toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-2 text-xs font-medium">
          {(
            [
              { value: "fixed", label: "Fixed price" },
              { value: "per_hour", label: "Per hour" },
              { value: "per_day", label: "Per day" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setRateType(opt.value);
                setQuantity("");
              }}
              className={`flex-1 py-1.5 transition-colors ${
                rateType === opt.value
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {rateType === "fixed" ? (
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
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
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
                  placeholder={
                    rateType === "per_hour" ? "Rate per hour" : "Rate per day"
                  }
                />
              </div>
              <span className="text-gray-400 text-sm shrink-0">×</span>
              <div className="relative w-28">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    clearFieldError("quantity");
                  }}
                  className={`w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:border-transparent text-sm transition-all ${
                    fieldErrors.quantity
                      ? "border-red-400 focus:ring-red-300"
                      : "border-gray-200 focus:ring-blue-500"
                  }`}
                  placeholder={rateType === "per_hour" ? "Hours" : "Days"}
                />
              </div>
            </div>
            {rate > 0 && qty > 0 && (
              <p className="text-sm font-semibold text-green-700">
                Total: £{formattedTotalBudget}
              </p>
            )}
          </div>
        )}
        {fieldErrors.budget && (
          <p className="text-xs text-red-500 mt-1">{fieldErrors.budget}</p>
        )}
        {fieldErrors.quantity && (
          <p className="text-xs text-red-500 mt-1">{fieldErrors.quantity}</p>
        )}
        {!fieldErrors.budget && !fieldErrors.quantity && (
          <p className="text-xs text-gray-400 mt-1">
            {rateType === "fixed"
              ? "Total price for the whole job — held in escrow when a kinglancer is selected."
              : rateType === "per_hour"
                ? "Enter your hourly rate and how many hours you expect the work to take. The total is held in escrow."
                : "Enter your daily rate and how many days you expect the work to take. The total is held in escrow."}
          </p>
        )}
      </div>

      {/* Deadline */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Deadline <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="date"
          value={deadline}
          min={minDateStr}
          onChange={(e) => setDeadline(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
        />
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
      </div>

      {workMode === "in_person" && (
        <>
          {/* Location */}
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

          {/* Date & time of attendance */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Date &amp; time of attendance{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
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
        </>
      )}

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
