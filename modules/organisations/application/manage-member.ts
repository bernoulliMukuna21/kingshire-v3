import { OrganisationError } from "../domain/errors";
import type { OrganisationMemberRole } from "../domain/types";
import type { OrganisationRepository } from "../repositories/organisation-repository";

async function requireManageableMember(
  repository: OrganisationRepository,
  organisationId: string,
  actorId: string,
  targetUserId: string,
) {
  const [actor, target] = await Promise.all([
    repository.findMembership(organisationId, actorId),
    repository.findMembership(organisationId, targetUserId),
  ]);
  if (!actor || !target || !["owner", "admin"].includes(actor.role)) {
    throw new OrganisationError("forbidden", "Forbidden");
  }
  if (target.role === "owner") {
    throw new OrganisationError(
      "conflict",
      "The Owner cannot be changed or removed.",
    );
  }
  if (actor.role === "admin" && target.role === "admin") {
    throw new OrganisationError(
      "forbidden",
      "Only the Owner can manage Admins.",
    );
  }
  return actor;
}

export async function updateOrganisationMemberRole(
  repository: OrganisationRepository,
  input: {
    organisationId: string;
    actorId: string;
    targetUserId: string;
    role: OrganisationMemberRole;
  },
) {
  const actor = await requireManageableMember(
    repository,
    input.organisationId,
    input.actorId,
    input.targetUserId,
  );
  const role = input.role === "admin" ? "admin" : "member";
  if (role === "admin" && actor.role !== "owner") {
    throw new OrganisationError(
      "forbidden",
      "Only the Owner can appoint Admins.",
    );
  }
  await repository.updateMemberRole(
    input.organisationId,
    input.targetUserId,
    role,
  );
  return { role };
}

export async function removeOrganisationMember(
  repository: OrganisationRepository,
  input: {
    organisationId: string;
    actorId: string;
    targetUserId: string;
  },
) {
  await requireManageableMember(
    repository,
    input.organisationId,
    input.actorId,
    input.targetUserId,
  );
  await repository.removeMember(input.organisationId, input.targetUserId);
}
