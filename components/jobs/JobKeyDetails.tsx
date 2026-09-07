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
  showExactLocation = false,
  className,
}: {
  job: JobKeyDetailsData;
  showExactLocation?: boolean;
  className?: string;
}) {
  const schedule = jobScheduleLabel(job);
  const isOnline = job.work_mode === "online";
  const daysSuffix =
    job.work_mode === "hybrid" && job.days_on_site
      ? ` · ${job.days_on_site} day${
          job.days_on_site > 1 ? "s" : ""
        } on-site/week`
      : "";
  const publicArea = job.location_area ?? job.location;

  const lat = job.latitude != null ? Number(job.latitude) : NaN;
  const lng = job.longitude != null ? Number(job.longitude) : NaN;
  const hasGeo = !Number.isNaN(lat) && !Number.isNaN(lng);
  const d = 0.008;
  const mapSrc =
    showExactLocation && hasGeo
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${
          lng - d
        }%2C${lat - d}%2C${lng + d}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lng}`
      : null;

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
            {!isOnline &&
              (showExactLocation ? (
                <>
                  <p className="text-slate-500">
                    {publicArea}
                    {job.postcode ? ` · ${job.postcode}` : ""}
                    {daysSuffix}
                  </p>
                  {job.address_line ? (
                    <p className="text-slate-500">{job.address_line}</p>
                  ) : null}
                </>
              ) : publicArea ? (
                <p className="text-slate-500">
                  {publicArea}
                  {daysSuffix}
                </p>
              ) : null)}
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

        {mapSrc && (
          <div>
            <iframe
              title="Job location map"
              src={mapSrc}
              loading="lazy"
              className="h-56 w-full rounded-xl border border-slate-200"
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Approximate area around the postcode — not the exact building.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
