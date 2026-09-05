/**
 * Compatibility facade while existing domains migrate to the modular
 * architecture. New Organisation code should import from modules/ and
 * infrastructure/ directly.
 */
import { requireOrganisationPermission as requirePermission } from "@/modules/organisations/application/permissions";
import {
  hasOrganisationPermission,
} from "@/modules/organisations/domain/permissions";
import type {
  OrganisationMemberRole,
  OrganisationPermission,
} from "@/modules/organisations/domain/types";
import { organisationRepository } from "@/infrastructure/supabase/repositories/supabase-organisation-repository";

export { hasOrganisationPermission };
export type { OrganisationMemberRole, OrganisationPermission };

export function getOrganisationMembership(
  organisationId: string,
  userId: string,
) {
  return organisationRepository.findMembership(organisationId, userId);
}

export function requireOrganisationPermission(
  organisationId: string,
  userId: string,
  permission: OrganisationPermission,
) {
  return requirePermission(
    organisationRepository,
    organisationId,
    userId,
    permission,
  );
}

export type OrganisationOwnedJob = {
  client_id: string;
  organisation_id?: string | null;
};

export async function canManageJob(
  job: OrganisationOwnedJob,
  userId: string,
  permission: "manage_jobs" | "manage_applicants" = "manage_jobs",
) {
  if (!job.organisation_id) return job.client_id === userId;
  return Boolean(
    await requireOrganisationPermission(
      job.organisation_id,
      userId,
      permission,
    ),
  );
}
