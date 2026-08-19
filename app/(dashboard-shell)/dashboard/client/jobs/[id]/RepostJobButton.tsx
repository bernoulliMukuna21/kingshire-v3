"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import ConfirmModal from "@/components/ConfirmModal";

type RepostJob = {
  id: string;
  title: string;
  description: string;
  categories: string[];
  budget: number;
  rate_type: "fixed" | "per_hour" | "per_day";
  work_mode: "online" | "in_person" | "hybrid";
  location: string | null;
  days_on_site: number | null;
  organisation_id: string | null;
};

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500";

const WORK_MODE_LABEL: Record<RepostJob["work_mode"], string> = {
  online: "Online / remote",
  hybrid: "Hybrid",
  in_person: "In person",
};

export default function RepostJobButton({ job }: { job: RepostJob }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(String(job.budget));
  const [location, setLocation] = useState(job.location ?? "");
  const [deadline, setDeadline] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [daysOnSite, setDaysOnSite] = useState(String(job.days_on_site ?? 2));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsLocation = job.work_mode !== "online";
  const minDate = new Date().toISOString().split("T")[0];

  function validate(): string | null {
    if (!(Number(price) > 0)) return "Enter the price for the new job.";
    if (needsLocation && !location.trim())
      return "Confirm the location for the new job.";
    if (job.work_mode === "online" && !deadline)
      return "Set a deadline for the new job.";
    if (job.work_mode === "in_person") {
      if (!/T\d{2}:\d{2}/.test(scheduledAt))
        return "Set the start date and time.";
      if (!/T\d{2}:\d{2}/.test(endsAt)) return "Set the end date and time.";
      if (new Date(endsAt).getTime() <= new Date(scheduledAt).getTime())
        return "The end time must be after the start time.";
    }
    if (job.work_mode === "hybrid") {
      const days = Number(daysOnSite);
      if (!Number.isInteger(days) || days < 1 || days > 6)
        return "Set days on-site per week (1–6).";
    }
    return null;
  }

  async function submit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: job.title,
        description: job.description,
        categories: job.categories,
        budget: Number(price),
        rate_type: job.rate_type,
        work_mode: job.work_mode,
        location: needsLocation ? location.trim() : null,
        scheduled_at: job.work_mode === "in_person" ? scheduledAt : null,
        ends_at: job.work_mode === "in_person" ? endsAt : null,
        days_on_site: job.work_mode === "hybrid" ? Number(daysOnSite) : null,
        deadline: job.work_mode === "in_person" ? null : deadline || null,
        organisation_id: job.organisation_id ?? null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Could not repost the job.");
      return;
    }
    setOpen(false);
    router.push(`/dashboard/client/jobs/${data.job.id}`);
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Repost job
      </Button>
      <ConfirmModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={submit}
        title="Repost this job?"
        confirmLabel="Repost job"
        loading={loading}
        error={error ?? undefined}
        message={
          <div className="space-y-4 text-left">
            <p className="text-sm text-slate-600">
              This creates a new{" "}
              <span className="font-bold text-slate-900">
                {WORK_MODE_LABEL[job.work_mode]}
              </span>{" "}
              job from{" "}
              <span className="font-bold text-slate-900">
                &ldquo;{job.title}&rdquo;
              </span>
              . Set a new date, then confirm the price and location.
            </p>

            {job.work_mode === "in_person" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Starts
                  </label>
                  <input
                    type="datetime-local"
                    className={fieldClass}
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Ends
                  </label>
                  <input
                    type="datetime-local"
                    className={fieldClass}
                    value={endsAt}
                    min={scheduledAt || undefined}
                    onChange={(e) => setEndsAt(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  New deadline{" "}
                  {job.work_mode === "online" ? (
                    <span className="text-red-500">*</span>
                  ) : (
                    <span className="font-normal text-slate-400">
                      (optional)
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  min={minDate}
                  className={fieldClass}
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            )}

            {job.work_mode === "hybrid" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Days on-site per week (max 6)
                </label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  className={fieldClass}
                  value={daysOnSite}
                  onChange={(e) => setDaysOnSite(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Price (£)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                className={fieldClass}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>

            {needsLocation && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Location
                </label>
                <input
                  className={fieldClass}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Address or area where the work happens"
                />
              </div>
            )}
          </div>
        }
      />
    </>
  );
}
