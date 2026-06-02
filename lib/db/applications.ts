import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

type Application = Database["public"]["Tables"]["applications"]["Row"];
type ApplicationInsert = Database["public"]["Tables"]["applications"]["Insert"];

export type ApplicationWithKinglancer = Application & {
  kinglancer: {
    full_name: string;
    avatar_url: string | null;
    skills: string[];
    rating: number;
    jobs_completed: number;
    bio: string | null;
    location: string | null;
  };
};

export type ApplicationWithJob = Application & {
  job: Database["public"]["Tables"]["jobs"]["Row"];
};

export async function getApplicationsByJob(
  jobId: string,
): Promise<ApplicationWithKinglancer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .select(
      "*, kinglancer:profiles!kinglancer_id(full_name, avatar_url, skills, rating, jobs_completed, bio, location)",
    )
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as ApplicationWithKinglancer[];
}

export async function getApplicationsByKinglancer(
  kinglancerId: string,
): Promise<ApplicationWithJob[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .select("*, job:jobs(*)")
    .eq("kinglancer_id", kinglancerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as ApplicationWithJob[];
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

  // Accept the selected application
  const { error: acceptError } = await db
    .from("applications")
    .update({ status: "accepted" })
    .eq("id", applicationId);

  if (acceptError) throw acceptError;

  // Reject all other pending applications for this job
  const { error: rejectError } = await db
    .from("applications")
    .update({ status: "rejected" })
    .eq("job_id", jobId)
    .neq("id", applicationId)
    .eq("status", "pending");

  if (rejectError) throw rejectError;

  // Assign kinglancer and mark job as in_progress (contract created)
  const { error: jobError } = await db
    .from("jobs")
    .update({ status: "in_progress", kinglancer_id: kinglancerId })
    .eq("id", jobId);

  if (jobError) throw jobError;
}
