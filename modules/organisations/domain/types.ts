export const ORGANISATION_TYPES = [
  "company",
  "charity",
  "church",
  "non_profit",
  "community_group",
  "public_body",
  "other",
] as const;

export type OrganisationType = (typeof ORGANISATION_TYPES)[number];
export type OrganisationMemberRole = "owner" | "admin" | "member";

export type OrganisationPermission =
  | "manage_organisation"
  | "manage_members"
  | "manage_jobs"
  | "manage_applicants"
  | "delete_organisation"
  | "manage_billing";

export type OrganisationMembership = {
  organisation_id: string;
  user_id: string;
  role: OrganisationMemberRole;
};

export type OrganisationProfileInput = {
  name: string;
  organisationType: OrganisationType;
  description: string | null;
  country: string;
  location: string | null;
  website: string | null;
  registrationNumber: string | null;
};
