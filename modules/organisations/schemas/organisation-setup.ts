import { OrganisationError } from "../domain/errors";
import {
  isOrganisationPlanId,
  type OrganisationPlanId,
} from "../domain/plans";
import type { OrganisationProfileInput } from "../domain/types";
import { parseOrganisationProfile } from "./organisation-profile";

export type OrganisationSetupInput = {
  profile: OrganisationProfileInput;
  planId: OrganisationPlanId;
  requestKey: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseOrganisationSetup(value: unknown): OrganisationSetupInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OrganisationError("invalid_input", "Invalid setup details.");
  }

  const body = value as Record<string, unknown>;
  const planId = body.plan_id;
  const requestKey = String(body.request_key ?? "").trim();

  if (!isOrganisationPlanId(planId)) {
    throw new OrganisationError(
      "invalid_input",
      "Select a valid Organisation plan.",
    );
  }
  if (!UUID_PATTERN.test(requestKey)) {
    throw new OrganisationError(
      "invalid_input",
      "The setup request is invalid. Refresh the page and try again.",
    );
  }

  return {
    profile: parseOrganisationProfile(body),
    planId,
    requestKey,
  };
}
