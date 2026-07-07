import type { Database } from "@/lib/supabase/types";

/** Derived from the Supabase schema — stays in sync automatically. */
export type JobStatus = Database["public"]["Tables"]["jobs"]["Row"]["status"];

/** Page size used across all job list views (client, kinglancer, admin). */
export const JOBS_PAGE_SIZE = 5;
