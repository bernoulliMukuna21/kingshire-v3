import { OrganisationError } from "../domain/errors";
import type { OrganisationMemberRole } from "../domain/types";

export function parseMemberRoleUpdate(
  value: unknown,
): Exclude<OrganisationMemberRole, "owner"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OrganisationError("invalid_input", "Invalid request body.");
  }
  const role = (value as Record<string, unknown>).role;
  if (role !== "admin" && role !== "member") {
    throw new OrganisationError(
      "invalid_input",
      "Select a valid Organisation role.",
    );
  }
  return role;
}
