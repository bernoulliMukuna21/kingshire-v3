import { OrganisationError } from "../domain/errors";
import type { OrganisationRepository } from "../repositories/organisation-repository";
import { parseInvitation } from "../schemas/invitation";
import { requireOrganisationPermission } from "./permissions";

export async function inviteOrganisationMember(
  repository: OrganisationRepository,
  input: {
    organisationId: string;
    actorId: string;
    body: unknown;
  },
) {
  const membership = await requireOrganisationPermission(
    repository,
    input.organisationId,
    input.actorId,
    "manage_members",
  );
  if (!membership) {
    throw new OrganisationError(
      "forbidden",
      "You cannot invite members.",
    );
  }
  const invitation = parseInvitation(input.body);
  if (invitation.role === "admin" && membership.role !== "owner") {
    throw new OrganisationError(
      "forbidden",
      "Only the Owner can invite an Admin.",
    );
  }
  const created = await repository.createInvitation({
    organisationId: input.organisationId,
    actorId: input.actorId,
    ...invitation,
  });
  return { ...created, email: invitation.email };
}
