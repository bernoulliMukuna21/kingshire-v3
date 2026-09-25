import { createServiceClient } from "@/lib/supabase/service";

/** Caller must authorise manage_applicants before offering. The database locks
 * the job and atomically creates/reopens its engagement and offers the application. */
export async function offerRoleApplication(
  applicationId: string,
  signerId: string,
) {
  const { data, error } = await createServiceClient().rpc(
    "offer_role_application",
    {
      p_application_id: applicationId,
      p_signer_id: signerId,
    },
  );
  if (error) throw error;
  return data;
}
