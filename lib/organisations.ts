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
import { createServiceClient } from "@/lib/supabase/service";

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

/**
 * A single contact for org-level notifications. Org-owned resources don't
 * have one "poster" the way personal jobs have a `client_id` — this is the
 * one recipient we notify until org notification preferences exist.
 */
export async function getOrgOwnerContact(
  organisationId: string,
): Promise<{ userId: string; email: string | null } | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("organisation_members")
    .select("user_id, profiles!user_id(email)")
    .eq("organisation_id", organisationId)
    .eq("role", "owner")
    .maybeSingle();
  if (!data) return null;
  const profile = data.profiles as
    | { email: string }
    | { email: string }[]
    | null;
  const email = Array.isArray(profile)
    ? (profile[0]?.email ?? null)
    : (profile?.email ?? null);
  return { userId: data.user_id, email };
}
