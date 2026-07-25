import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

type Job = Database["public"]["Tables"]["jobs"]["Row"];
type JobInsert = Database["public"]["Tables"]["jobs"]["Insert"];

export type JobWithClient = Job & {
  client: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    rating: number;
    total_reviews: number;
  };
  application_count?: number;
};

export { JOB_CATEGORIES } from "@/lib/job-categories";

export async function getOpenJobs(): Promise<JobWithClient[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "*, client:profiles!client_id(id, full_name, avatar_url, rating, total_reviews)",
    )
    .eq("status", "open")
    .is("invited_kinglancer_id", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []) as unknown as JobWithClient[];
}

export async function getJobById(
  id: string,
  options?: { useServiceRole?: boolean },
): Promise<JobWithClient | null> {
  const supabase = options?.useServiceRole
    ? createServiceClient()
    : await createClient();
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "*, client:profiles!client_id(id, full_name, avatar_url, rating, total_reviews)",
    )
    .eq("id", id)
    .single();

  if (error) return null;
  return data as unknown as JobWithClient;
}

export async function createJob(
  data: JobInsert,
  options?: { useServiceRole?: boolean },
): Promise<Job> {
  const supabase = options?.useServiceRole
    ? createServiceClient()
    : await createClient();
  const { data: job, error } = await supabase
    .from("jobs")
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return job;
}
