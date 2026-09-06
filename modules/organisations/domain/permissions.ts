import type {
  OrganisationMemberRole,
  OrganisationPermission,
} from "./types";

const ROLE_PERMISSIONS: Record<
  OrganisationMemberRole,
  readonly OrganisationPermission[]
> = {
  owner: [
    "manage_organisation",
    "manage_members",
    "manage_jobs",
    "manage_applicants",
    "delete_organisation",
    "manage_billing",
  ],
  admin: [
    "manage_organisation",
    "manage_members",
    "manage_jobs",
    "manage_applicants",
  ],
  member: ["manage_jobs", "manage_applicants"],
};

export function hasOrganisationPermission(
  role: OrganisationMemberRole,
  permission: OrganisationPermission,
) {
  return ROLE_PERMISSIONS[role].includes(permission);
}
