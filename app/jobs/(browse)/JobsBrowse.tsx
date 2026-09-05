import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { FadeIn } from "@/components/animations";
import type { JobWithClient } from "@/lib/db/jobs";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import JobsList from "../JobsList";

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

export default async function JobsBrowse() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let appliedJobIds: string[] = [];

  if (user) {
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

  return (
    <FadeIn>
      <JobsList jobs={jobs} appliedJobIds={appliedJobIds} />
    </FadeIn>
  );
}
