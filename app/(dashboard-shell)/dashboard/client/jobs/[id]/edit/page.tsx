import { notFound, redirect } from "next/navigation";
import { getDashboardContext } from "@/lib/dashboard-context";
import { getJobById } from "@/lib/db/jobs";
import { JOB_CATEGORIES } from "@/lib/job-categories";
import DashboardBackLink from "@/components/dashboard/DashboardBackLink";
import EditJobForm from "./EditJobForm";
import { canManageJob } from "@/lib/organisations";
import { createServiceClient } from "@/lib/supabase/service";

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, profile, supabase } = await getDashboardContext();

  const job = await getJobById(id, { useServiceRole: true });
  if (!job) notFound();
  if (!(await canManageJob(job, user.id))) {
    if (profile.role !== "client") redirect("/onboarding");
    notFound();
  }
  if (job.status !== "open")
    redirect(`/dashboard/client/jobs/${id}`);

  // Check if anyone has applied — budget is locked if so
  const applicationDb = job.organisation_id ? createServiceClient() : supabase;
  const { count } = await applicationDb
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("job_id", id)
    .neq("status", "rejected");

  const hasApplicants = (count ?? 0) > 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:py-10">
      <DashboardBackLink
        fallbackHref={`/dashboard/client/jobs/${id}`}
        fallbackLabel="Back to job"
      />
      <div className="mt-6">
        <h1 className="text-2xl font-black text-slate-950">Edit job</h1>
        <p className="mt-1 text-sm text-slate-500">
          Changes apply to the public listing immediately.
        </p>
      </div>
      <div className="mt-8">
        <EditJobForm
          jobId={id}
          hasApplicants={hasApplicants}
          initialData={{
            title: job.title,
            description: job.description,
            categories: job.categories ?? [],
            budget: String(job.budget),
            rateType: (job.rate_type ?? "fixed") as "fixed" | "per_hour" | "per_day",
            deadline: job.deadline ?? "",
          }}
          categories={JOB_CATEGORIES as unknown as string[]}
        />
      </div>
    </div>
  );
}
