import { FadeIn } from "@/components/animations";
import { getOpenJobs } from "@/lib/db/jobs";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import JobsList from "../JobsList";
import PublicHero from "@/components/ui/PublicHero";
import PublicShell from "@/components/ui/PublicShell";

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

  const jobs = await getOpenJobs();
  const visibleJobs = user
    ? jobs.filter((job) => job.client_id !== user.id)
    : jobs;

  return (
    <PublicShell>
      <PublicHero
        title="Browse Jobs"
        description="Find paid work posted by trusted community members."
      />
      <section className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <FadeIn>
            <JobsList jobs={visibleJobs} />
          </FadeIn>
        </div>
      </section>
    </PublicShell>
  );
}
