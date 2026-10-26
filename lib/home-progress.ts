import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { listPublicPlacements } from "@/lib/db/placements";
import { coerceNumeric } from "@/lib/db/coerce";
import type { HomeProgress } from "@/lib/home-news";

// Shared by the hero counters and progress news; no per-audience data is cached.
export const getHomepageProgress = unstable_cache(
  async (): Promise<HomeProgress> => {
    const db = createServiceClient();
    const [people, jobs, kinglancers, leader, placements] = await Promise.all([
      db
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .or("role.is.null,role.neq.admin"),
      db.from("jobs").select("id", { count: "exact", head: true }),
      db
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "kinglancer"),
      db
        .from("profiles")
        .select("id,full_name,jobs_completed")
        .eq("role", "kinglancer")
        .gt("jobs_completed", 0)
        .order("jobs_completed", { ascending: false })
        .order("id")
        .limit(1),
      listPublicPlacements().catch(() => null),
    ]);
    const top =
      !leader.error && leader.data?.[0]
        ? coerceNumeric(leader.data[0], ["jobs_completed"])
        : null;
    return {
      peopleCount: people.error ? null : people.count,
      jobsCount: jobs.error ? null : jobs.count,
      kinglancersCount: kinglancers.error ? null : kinglancers.count,
      placementCount: placements?.length ?? null,
      internshipCount: placements
        ? placements.filter((row) => /\binternships?\b/i.test(row.title)).length
        : null,
      leadingKinglancer:
        top && Number.isFinite(top.jobs_completed) && top.full_name
          ? {
              id: top.id,
              name: top.full_name,
              jobsCompleted: top.jobs_completed,
            }
          : null,
    };
  },
  ["homepage-progress-v2"],
  { revalidate: 3600, tags: ["kinglancer-profiles"] },
);
