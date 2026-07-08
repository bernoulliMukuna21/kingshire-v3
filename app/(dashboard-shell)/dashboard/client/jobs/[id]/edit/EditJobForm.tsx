"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  CURRENCY_VALIDATION_MESSAGE,
  hasValidCurrencyPrecision,
} from "@/lib/validation";

type InitialData = {
  title: string;
  description: string;
  categories: string[];
  budget: string;
  rateType: "fixed" | "per_hour" | "per_day";
  deadline: string;
};

export default function EditJobForm({
  jobId,
  initialData,
  categories,
  hasApplicants,
}: {
  jobId: string;
  initialData: InitialData;
  categories: string[];
  hasApplicants: boolean;
}) {
  const router = useRouter();

  const [title, setTitle] = useState(initialData.title);
  const [description, setDescription] = useState(initialData.description);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialData.categories,
  );
  const [budget, setBudget] = useState(initialData.budget);
  const [rateType, setRateType] = useState<"fixed" | "per_hour" | "per_day">(
    initialData.rateType,
  );
  const [deadline, setDeadline] = useState(initialData.deadline);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minDate = new Date().toISOString().split("T")[0];

  const toggleCategory = (cat: string) =>
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!hasValidCurrencyPrecision(budget)) {
      setError(CURRENCY_VALIDATION_MESSAGE);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          categories: selectedCategories,
          budget,
          rate_type: rateType,
          deadline: deadline || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update job. Please try again.");
        return;
      }

      router.push(`/dashboard/client/jobs/${jobId}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Title */}
      <div className="space-y-1.5">
        <label className="block text-sm font-bold text-slate-900">
          Job title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          placeholder="e.g. Experienced plumber needed"
          minLength={3}
          maxLength={120}
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="block text-sm font-bold text-slate-900">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          placeholder="Describe the work, requirements, and any relevant details."
          minLength={10}
          maxLength={2000}
          required
        />
      </div>

      {/* Categories */}
      <div className="space-y-2">
        <label className="block text-sm font-bold text-slate-900">
          Categories
        </label>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const selected = selectedCategories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                  selected
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
        {selectedCategories.length === 0 && (
          <p className="text-xs text-red-600">
            Select at least one category.
          </p>
        )}
      </div>

      {/* Budget + Rate type */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-900">
            Budget (£)
          </label>
          {hasApplicants ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
              <p className="text-sm font-bold text-slate-900">£{budget}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Budget is locked — applicants have already applied at this rate.
              </p>
            </div>
          ) : (
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              min="5"
              max="50000"
              step="0.01"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="e.g. 150"
              required
            />
          )}
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-slate-900">
            Rate type
          </label>
          <select
            value={rateType}
            onChange={(e) =>
              setRateType(e.target.value as "fixed" | "per_hour" | "per_day")
            }
            disabled={hasApplicants}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="fixed">Fixed price</option>
            <option value="per_hour">Per hour</option>
            <option value="per_day">Per day</option>
          </select>
        </div>
      </div>

      {/* Deadline */}
      <div className="space-y-1.5">
        <label className="block text-sm font-bold text-slate-900">
          Deadline{" "}
          <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          min={minDate}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading || selectedCategories.length === 0}
          className="flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          Save changes
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-2xl border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
