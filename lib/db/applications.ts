import { resolveCvPath } from "@/lib/cv-storage";
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
  return ((data ?? []) as unknown as ApplicationWithKinglancer[]).map(
    (app) => ({
      ...app,
      cv_path: resolveCvPath(
        "job-application-cvs",
        app.cv_path ?? app.cv_url,
        app.kinglancer_id,
      ),
    }),
  );
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
    .insert({
      ...data,
      cv_url: data.cv_path
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/job-application-cvs/${data.cv_path}`
        : data.cv_url,
    })
    .select()
    .single();

  if (error) throw error;
  return app;
}
