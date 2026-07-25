import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

type Application = Database["public"]["Tables"]["applications"]["Row"];
type ApplicationInsert = Database["public"]["Tables"]["applications"]["Insert"];

export type ApplicationWithKinglancer = Application & {
  kinglancer: {
    full_name: string;
    avatar_url: string | null;
    service_tags: string[];
    rating: number;
    jobs_completed: number;
    bio: string | null;
    location: string | null;
  };
};

export class ApplicantSelectionConflictError extends Error {
  constructor() {
    super("A kinglancer has already been selected for this job");
    this.name = "ApplicantSelectionConflictError";
  }
}

export async function getApplicationsByJob(
  jobId: string,
  options?: { useServiceRole?: boolean },
): Promise<ApplicationWithKinglancer[]> {
  const supabase = options?.useServiceRole
    ? createServiceClient()
    : await createClient();
  const { data, error } = await supabase
    .from("applications")
    .select(
      "*, kinglancer:profiles!kinglancer_id(full_name, avatar_url, service_tags, rating, jobs_completed, bio, location)",
    )
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as ApplicationWithKinglancer[];
}

export async function hasApplied(
  jobId: string,
  kinglancerId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("applications")
    .select("id")
    .eq("job_id", jobId)
    .eq("kinglancer_id", kinglancerId)
    .maybeSingle();

  return !!data;
}

export async function createApplication(
  data: ApplicationInsert,
): Promise<Application> {
  const supabase = await createClient();
  const { data: app, error } = await supabase
    .from("applications")
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return app;
}

export async function selectApplicant(
  jobId: string,
  applicationId: string,
  kinglancerId: string,
): Promise<void> {
  const db = createServiceClient();

  // Reserve the job first. This is the critical idempotency guard: only one
  // payment-start request can move an open job into progress.
  const { data: reservedJob, error: reserveError } = await db
    .from("jobs")
    .update({ status: "in_progress", kinglancer_id: kinglancerId })
    .eq("id", jobId)
    .eq("status", "open")
    .is("kinglancer_id", null)
    .select("id")
    .maybeSingle();

  if (reserveError) throw reserveError;
  if (!reservedJob) throw new ApplicantSelectionConflictError();

  // Accept the selected application, but only if it is still pending.
  const { data: acceptedApplication, error: acceptError } = await db
    .from("applications")
    .update({ status: "accepted" })
    .eq("id", applicationId)
    .eq("job_id", jobId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (acceptError || !acceptedApplication) {
    await db
      .from("jobs")
      .update({ status: "open", kinglancer_id: null })
      .eq("id", jobId);
    if (acceptError) throw acceptError;
    throw new ApplicantSelectionConflictError();
  }

  // Reject all other pending applications for this job
  const { error: rejectError } = await db
    .from("applications")
    .update({ status: "rejected" })
    .eq("job_id", jobId)
    .neq("id", applicationId)
    .eq("status", "pending");

  if (rejectError) {
    await Promise.all([
      db
        .from("jobs")
        .update({ status: "open", kinglancer_id: null })
        .eq("id", jobId),
      db
        .from("applications")
        .update({ status: "pending" })
        .eq("id", applicationId),
    ]);
    throw rejectError;
  }
}
