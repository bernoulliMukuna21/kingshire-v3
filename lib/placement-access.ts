import { createClient } from "@/lib/supabase/server";
import { requireOrganisationPermission } from "@/lib/organisations";
import { getAgreement, type PlacementAgreementRow } from "@/lib/db/placements";

export type AgreementAccess =
  | {
      ok: true;
      userId: string;
      agreement: PlacementAgreementRow;
      isKinglancer: boolean;
      isOrgManager: boolean;
    }
  | { ok: false; status: number; error: string };

/**
 * Authorises the current user against a placement agreement. Either the
 * participant (kinglancer) or an organisation manager may access it.
 */
export async function authoriseAgreement(
  agreementId: string,
): Promise<AgreementAccess> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorised" };

  const agreement = await getAgreement(agreementId);
  if (!agreement) {
    return { ok: false, status: 404, error: "Agreement not found." };
  }

  const isKinglancer = agreement.kinglancer_id === user.id;
  const isOrgManager =
    !isKinglancer &&
    !!(await requireOrganisationPermission(
      agreement.organisation_id,
      user.id,
      "manage_jobs",
    ));

  if (!isKinglancer && !isOrgManager) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true, userId: user.id, agreement, isKinglancer, isOrgManager };
}
