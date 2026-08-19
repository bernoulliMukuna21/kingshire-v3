import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPublicPlacement } from "@/lib/db/placements";
import {
  COMPENSATION_LABELS,
  formatCompensationDetail,
  placementWorkModeSummary,
} from "@/lib/placements";
import PublicShell from "@/components/ui/PublicShell";
import PublicHero from "@/components/ui/PublicHero";
import { Card } from "@/components/ui/Card";
import ApplyButton from "@/app/(dashboard-shell)/dashboard/kinglancer/placements/ApplyButton";

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
}

function Label({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase text-slate-400">{children}</p>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <p className="mt-1 text-sm text-slate-700">{value}</p>
    </div>
  );
}

export default async function PublicPlacementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const placement = await getPublicPlacement(id);
  if (!placement) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let role: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    role = profile?.role ?? null;
  }

  const dateRange = [
    formatDate(placement.start_date),
    formatDate(placement.end_date),
  ]
    .filter(Boolean)
    .join(" → ");

  return (
    <PublicShell>
      <PublicHero
        eyebrow={placement.organisation?.name ?? "Organisation"}
        title={placement.title}
        description="A supervised experience placement — not a paid job."
      />
      <section className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <Card className="grid gap-4 p-5 sm:grid-cols-2">
            <Meta label="Work mode" value={placementWorkModeSummary(placement)} />
            <Meta
              label="Weekly hours"
              value={`${placement.weekly_hours} hours per week`}
            />
            <Meta
              label="Duration"
              value={`${placement.duration_weeks} week${
                placement.duration_weeks === 1 ? "" : "s"
              }`}
            />
            <Meta label="Runs from" value={dateRange || "Not set"} />
            <div className="sm:col-span-2">
              <Meta
                label="Categories"
                value={placement.categories.join(", ")}
              />
            </div>
          </Card>

          {placement.summary && (
            <Card className="p-5">
              <Label>About</Label>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                {placement.summary}
              </p>
            </Card>
          )}

          <Card className="p-5">
            <Label>What you&apos;ll contribute</Label>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
              {placement.contribution}
            </p>
          </Card>

          {placement.compensation_types.length > 0 && (
            <Card className="p-5">
              <Label>Compensation</Label>
              <ul className="mt-2 space-y-1.5">
                {placement.compensation_types.map((type) => (
                  <li
                    key={type}
                    className="flex flex-wrap items-baseline gap-2 text-sm"
                  >
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                      {COMPENSATION_LABELS[type] ?? type}
                    </span>
                    <span className="text-slate-700">
                      {formatCompensationDetail(
                        type,
                        placement.compensation_details?.[type],
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
            <p className="text-sm font-semibold text-slate-700">
              Interested in this placement?
            </p>
            {role === "kinglancer" ? (
              <ApplyButton placementId={id} />
            ) : !user ? (
              <Link
                href="/sign-in"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
              >
                Sign in to apply
              </Link>
            ) : (
              <p className="text-xs text-slate-500">
                Placements are open to Kinglancers.
              </p>
            )}
          </Card>
        </div>
      </section>
    </PublicShell>
  );
}
