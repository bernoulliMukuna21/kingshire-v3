import type { OrganisationRepository } from "../repositories/organisation-repository";
import { OrganisationError } from "../domain/errors";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function acceptOrganisationInvitation(
  repository: OrganisationRepository,
  input: { token: string; actorId: string; actorEmail: string },
) {
  if (!UUID_PATTERN.test(input.token)) {
    throw new OrganisationError(
      "expired",
      "This invitation is invalid or expired.",
    );
  }
  const organisationId = await repository.acceptInvitation(input);
  return { organisationId };
}
