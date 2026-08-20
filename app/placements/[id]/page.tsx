import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPublicPlacement, hasAppliedToPlacement } from "@/lib/db/placements";
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
  const alreadyApplied =
    role === "kinglancer" && user
      ? await hasAppliedToPlacement(id, user.id)
      : false;

  const dateRange = [
    formatDate(placement.start_date),
    formatDate(placement.end_date),
  ]
    .filter(Boolean)
    .join(" → ");

  const facts: Array<[string, string]> = [
    ["Work mode", placementWorkModeSummary(placement)],
    ["Hours", `${placement.weekly_hours} per week`],
    [
      "Duration",
      `${placement.duration_weeks} week${
        placement.duration_weeks === 1 ? "" : "s"
      }`,
    ],
    ["Dates", dateRange || "Not set"],
    ["Categories", placement.categories.join(", ")],
  ];

  return (
    <PublicShell>
      <PublicHero
        eyebrow={placement.organisation?.name ?? "Organisation"}
        title={placement.title}
      />
      <section className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Card className="space-y-7 p-6 sm:p-8">
            <div className="flex flex-wrap gap-x-8 gap-y-2 border-b border-slate-100 pb-6 text-sm text-slate-600">
              {facts.map(([label, value]) => (
                <span key={label}>
                  <span className="font-bold text-slate-900">{label}:</span>{" "}
                  {value}
                </span>
              ))}
            </div>

            {placement.summary && (
              <div>
                <h2 className="text-base font-black text-slate-900">
                  About this placement
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {placement.summary}
                </p>
              </div>
            )}

            <div>
              <h2 className="text-base font-black text-slate-900">
                What you&apos;ll contribute
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {placement.contribution}
              </p>
            </div>

            {placement.compensation_types.length > 0 && (
              <div>
                <h2 className="text-base font-black text-slate-900">
                  Compensation
                </h2>
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
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6">
              <p className="text-sm font-semibold text-slate-700">
                Interested in this placement?
              </p>
              {role === "kinglancer" ? (
                alreadyApplied ? (
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700">
                    ✓ Application sent
                  </span>
                ) : (
                  <ApplyButton placementId={id} />
                )
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
            </div>
          </Card>
        </div>
      </section>
    </PublicShell>
  );
}
