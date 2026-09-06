import { OrganisationError } from "../domain/errors";
import type { OrganisationMemberRole } from "../domain/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseInvitation(value: unknown): {
  email: string;
  role: Exclude<OrganisationMemberRole, "owner">;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OrganisationError("invalid_input", "Invalid request body.");
  }
  const body = value as Record<string, unknown>;
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    throw new OrganisationError(
      "invalid_input",
      "Enter a valid email.",
    );
  }
  return {
    email,
    role: body.role === "admin" ? "admin" : "member",
  };
}
