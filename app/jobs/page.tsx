import Navbar from "@/components/Navbar";
import { FadeIn } from "@/components/animations";
import { getOpenJobs } from "@/lib/db/jobs";
import { createClient } from "@/lib/supabase/server";
import JobsList from "./JobsList";

export default async function JobsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const jobs = await getOpenJobs();
  const visibleJobs = user
    ? jobs.filter((job) => job.client_id !== user.id)
    : jobs;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Hero bar */}
      <div className="bg-[#0f172a] pt-24 pb-12 px-6">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <h1 className="text-3xl md:text-4xl font-black text-white mb-2">
              Browse Jobs
            </h1>
            <p className="text-white/50 text-base mb-6">
              Find work posted by your community members.
            </p>
            <JobsList jobs={visibleJobs} />
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
