import { OrganisationError } from "../domain/errors";
import {
  ORGANISATION_TYPES,
  type OrganisationProfileInput,
  type OrganisationType,
} from "../domain/types";

function optionalText(value: unknown, maximum: number) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  if (normalized.length > maximum) {
    throw new OrganisationError(
      "invalid_input",
      `A field exceeds its ${maximum}-character limit.`,
    );
  }
  return normalized;
}

function optionalWebsite(value: unknown) {
  const website = optionalText(value, 500);
  if (!website) return null;
  try {
    const parsed = new URL(website);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Unsupported protocol");
    }
  } catch {
    throw new OrganisationError(
      "invalid_input",
      "Enter a valid Organisation website.",
    );
  }
  return website;
}

export function parseOrganisationProfile(
  value: unknown,
): OrganisationProfileInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OrganisationError("invalid_input", "Invalid request body.");
  }

  const body = value as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  const organisationType = String(body.organisation_type ?? "");
  const country = String(body.country ?? "").trim() || "United Kingdom";

  if (name.length < 2 || name.length > 120) {
    throw new OrganisationError(
      "invalid_input",
      "Organisation name must be between 2 and 120 characters.",
    );
  }
  if (
    !ORGANISATION_TYPES.includes(organisationType as OrganisationType)
  ) {
    throw new OrganisationError(
      "invalid_input",
      "Select a valid Organisation type.",
    );
  }
  if (country.length > 100) {
    throw new OrganisationError(
      "invalid_input",
      "Country must be 100 characters or fewer.",
    );
  }

  return {
    name,
    organisationType: organisationType as OrganisationType,
    description: optionalText(body.description, 1000),
    country,
    location: optionalText(body.location, 200),
    website: optionalWebsite(body.website),
    registrationNumber: optionalText(body.registration_number, 100),
  };
}
