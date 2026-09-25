"use client";

import { JOB_CATEGORIES } from "@/lib/job-categories";

export function CategoryPicker({
  categories,
  onToggle,
  error,
}: {
  categories: string[];
  onToggle: (category: string) => void;
  error?: string;
}) {
  return (
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
              onClick={() => onToggle(cat)}
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
      {error ? (
        <p className="text-xs text-red-500 mt-2">{error}</p>
      ) : categories.length > 0 ? (
        <p className="text-xs text-gray-400 mt-2">
          {categories.length} selected
        </p>
      ) : null}
    </div>
  );
}
