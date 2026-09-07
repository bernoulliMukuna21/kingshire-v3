import { Clock, MapPin, Monitor } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { jobScheduleLabel, type JobKeyDetailsData } from "@/lib/jobs";

const WORK_MODE_LABEL: Record<string, string> = {
  online: "Online / remote",
  in_person: "In person",
  hybrid: "Hybrid",
};

// Read-only display of a job's key facts (mode, location, schedule). Shared by
// the public, kinglancer and owner detail views so they can't drift.
export default function JobKeyDetails({
  job,
  className,
}: {
  job: JobKeyDetailsData;
  className?: string;
}) {
  const schedule = jobScheduleLabel(job);
  const isOnline = job.work_mode === "online";

  return (
    <Card className={className ?? "p-5 sm:p-6"}>
      <h2 className="text-lg font-black text-slate-950">Job details</h2>
      <div className="mt-4 space-y-4 text-sm text-slate-600">
        <div className="flex items-start gap-3">
          {isOnline ? (
            <Monitor size={16} className="mt-0.5 shrink-0 text-slate-400" />
          ) : (
            <MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" />
          )}
          <div>
            <p className="font-semibold text-slate-800">
              {WORK_MODE_LABEL[job.work_mode] ?? job.work_mode}
            </p>
            {!isOnline && job.location && (
              <p className="text-slate-500">
                {job.location}
                {job.work_mode === "hybrid" && job.days_on_site
                  ? ` · ${job.days_on_site} day${
                      job.days_on_site > 1 ? "s" : ""
                    } on-site/week`
                  : ""}
              </p>
            )}
          </div>
        </div>

        {schedule && (
          <div className="flex items-start gap-3">
            <Clock size={16} className="mt-0.5 shrink-0 text-slate-400" />
            <p>
              <span className="font-semibold text-slate-800">
                {schedule.heading}:
              </span>{" "}
              {schedule.value}
              {schedule.note ? (
                <span className="text-slate-500"> · {schedule.note}</span>
              ) : null}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
