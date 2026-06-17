import { unstable_cache } from "next/cache";
import { FadeIn } from "@/components/animations";
import type { JobWithClient } from "@/lib/db/jobs";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import JobsList from "../JobsList";
import PublicHero from "@/components/ui/PublicHero";
import PublicShell from "@/components/ui/PublicShell";

const getCachedOpenJobs = unstable_cache(
  async (): Promise<JobWithClient[]> => {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("jobs")
      .select("*, client:profiles!client_id(full_name, avatar_url)")
      .eq("status", "open")
      .is("invited_kinglancer_id", null)
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []) as unknown as JobWithClient[];
  },
  ["open-jobs"],
  { revalidate: 300, tags: ["open-jobs"] },
);

export default async function JobsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "client") {
      redirect("/dashboard/client/jobs");
    }
  }

  const jobs = await getCachedOpenJobs();
  const visibleJobs = user
    ? jobs.filter((job) => job.client_id !== user.id)
    : jobs;

  let appliedJobIds: string[] = [];
  if (user) {
    const { data: applications } = await supabase
      .from("applications")
      .select("job_id")
      .eq("kinglancer_id", user.id);
    appliedJobIds = (applications ?? []).map((a) => a.job_id);
  }

  return (
    <PublicShell>
      <PublicHero
        title="Browse Jobs"
        description="Find paid work posted by trusted community members."
      />
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
