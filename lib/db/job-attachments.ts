import { createClient } from "@/lib/supabase/server";
import { canAttachJobFile } from "@/lib/job-attachments";

/** Cookie client: subscription rows are restricted to the viewer's organisations. */
export async function getJobAttachmentOrganisationIds(): Promise<string[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("organisation_subscriptions")
    .select("organisation_id, status");
  if (error) throw error;
  return (data ?? []).filter((row) => canAttachJobFile(row.status))
    .map((row) => row.organisation_id);
}
