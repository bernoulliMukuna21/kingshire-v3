import { unstable_cache } from "next/cache";
import { FadeIn } from "@/components/animations";
import type { JobWithClient } from "@/lib/db/jobs";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import JobsList from "../JobsList";
import PublicHero from "@/components/ui/PublicHero";
import PublicShell from "@/components/ui/PublicShell";
import BrowseModeTabs from "@/components/ui/BrowseModeTabs";

const getCachedOpenJobs = unstable_cache(
  async (): Promise<JobWithClient[]> => {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("jobs")
      .select(
        "*, client:profiles!client_id(id, full_name, avatar_url, rating, total_reviews)",
      )
      .eq("status", "open")
      .is("invited_kinglancer_id", null)
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []) as unknown as JobWithClient[];
  },
  ["open-jobs"],
  { revalidate: 60, tags: ["open-jobs"] },
);

export default async function JobsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let appliedJobIds: string[] = [];

  if (user) {
    // Fetch profile and applied job IDs in parallel — both need user.id,
    // neither depends on the other.
    const [profileResult, applicationsResult] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      supabase
        .from("applications")
        .select("job_id")
        .eq("kinglancer_id", user.id),
    ]);

    if (profileResult.data?.role === "client") {
      redirect("/dashboard/client/jobs");
    }
    appliedJobIds = (applicationsResult.data ?? []).map((a) => a.job_id);
  }

  const jobs = await getCachedOpenJobs();
  const visibleJobs = jobs;

  return (
    <PublicShell>
      <PublicHero
        title="Browse Jobs"
        description="Find paid work posted by trusted community members."
      >
        <BrowseModeTabs active="jobs" />
      </PublicHero>
      <section className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <JobsList jobs={visibleJobs} appliedJobIds={appliedJobIds} />
          </FadeIn>
        </div>
      </section>
    </PublicShell>
  );
}
