"use client";

import {
  ESTIMATE_MINUTE_OPTIONS,
  formatEstimatedMinutes,
  type ScheduleType,
} from "@/lib/jobs";

// Shared shift/window chooser used by both the post form and the repost modal.
// Presentation only — the parent owns the state.
export default function ScheduleTypeField({
  scheduleType,
  onScheduleTypeChange,
  estimatedMinutes,
  onEstimatedMinutesChange,
}: {
  scheduleType: ScheduleType;
  onScheduleTypeChange: (value: ScheduleType) => void;
  estimatedMinutes: string;
  onEstimatedMinutesChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        How should the Kinglancer treat the times below?
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onScheduleTypeChange("window")}
          className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
            scheduleType === "window"
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Flexible window
        </button>
        <button
          type="button"
          onClick={() => onScheduleTypeChange("shift")}
          className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
            scheduleType === "shift"
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          Fixed shift
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        {scheduleType === "shift"
          ? "The Kinglancer works these exact hours."
          : "The Kinglancer can complete the task any time within this window."}
      </p>
      {scheduleType === "window" && (
        <div className="mt-3">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Estimated time <span className="text-gray-400">(optional)</span>
          </label>
          <select
            value={estimatedMinutes}
            onChange={(e) => onEstimatedMinutesChange(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Not sure</option>
            {ESTIMATE_MINUTE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {formatEstimatedMinutes(m)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">
            Helps Kinglancers know the job may take less than the full window.
          </p>
        </div>
      )}
    </div>
  );
}
