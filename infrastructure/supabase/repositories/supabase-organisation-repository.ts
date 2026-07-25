import { createServiceClient } from "@/lib/supabase/service";
import { OrganisationError } from "@/modules/organisations/domain/errors";
import type {
  OrganisationMembership,
  OrganisationMemberRole,
  OrganisationProfileInput,
} from "@/modules/organisations/domain/types";
import type { OrganisationRepository } from "@/modules/organisations/repositories/organisation-repository";

function mapRpcError(message: string) {
  if (message.includes("invalid or expired")) {
    return new OrganisationError(
      "expired",
      "This invitation is invalid or expired.",
    );
  }
  if (message.includes("another email")) {
    return new OrganisationError(
      "forbidden",
      "This invitation belongs to another email address.",
    );
  }
  return new OrganisationError(
    "persistence_failure",
    "The Organisation operation could not be completed.",
  );
}

export class SupabaseOrganisationRepository
  implements OrganisationRepository
{
  async createWithOwner(
    actorId: string,
    profile: OrganisationProfileInput,
  ) {
    const db = createServiceClient();
    const { data, error } = await db.rpc("create_organisation_with_owner", {
      p_actor_id: actorId,
      p_name: profile.name,
      p_organisation_type: profile.organisationType,
      p_description: profile.description,
      p_country: profile.country,
      p_location: profile.location,
      p_website: profile.website,
      p_email: profile.email,
      p_registration_number: profile.registrationNumber,
    });
    if (error || typeof data !== "string") {
      throw new OrganisationError(
        "persistence_failure",
        "Failed to create Organisation.",
      );
    }
    return data;
  }

  async acceptInvitation(input: {
    token: string;
    actorId: string;
    actorEmail: string;
  }) {
    const db = createServiceClient();
    const { data, error } = await db.rpc("accept_organisation_invitation", {
      p_token: input.token,
      p_actor_id: input.actorId,
      p_actor_email: input.actorEmail,
    });
    if (error || typeof data !== "string") {
      throw mapRpcError(error?.message ?? "Unknown invitation failure");
    }
    return data;
  }

  async findMembership(organisationId: string, userId: string) {
    const db = createServiceClient();
    const { data, error } = await db
      .from("organisation_members")
      .select(
        "organisation_id, user_id, role, organisation:organisations!inner(deleted_at)",
      )
      .eq("organisation_id", organisationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new OrganisationError(
        "persistence_failure",
        "Unable to verify Organisation membership.",
      );
    }
    if (
      !data ||
      (data.organisation as unknown as { deleted_at: string | null }).deleted_at
    ) {
      return null;
    }
    return {
      organisation_id: data.organisation_id,
      user_id: data.user_id,
      role: data.role,
    } as OrganisationMembership;
  }

  async updateProfile(
    organisationId: string,
    profile: OrganisationProfileInput,
  ) {
    const { error } = await createServiceClient()
      .from("organisations")
      .update({
        name: profile.name,
        email: profile.email,
        organisation_type: profile.organisationType,
        description: profile.description,
        country: profile.country,
        location: profile.location,
        website: profile.website,
        registration_number: profile.registrationNumber,
      })
      .eq("id", organisationId)
      .is("deleted_at", null);
    if (error) {
      throw new OrganisationError(
        "persistence_failure",
        "Unable to update Organisation.",
      );
    }
  }

  async transferOwnership(
    organisationId: string,
    currentOwnerId: string,
    newOwnerId: string,
  ) {
    const { error } = await createServiceClient().rpc(
      "transfer_organisation_ownership",
      {
        p_organisation_id: organisationId,
        p_current_owner_id: currentOwnerId,
        p_new_owner_id: newOwnerId,
      },
    );
    if (error) {
      throw new OrganisationError(
        "conflict",
        "Unable to transfer ownership.",
      );
    }
  }

  async deleteIfAllowed(organisationId: string, actorId: string) {
    const { error } = await createServiceClient().rpc(
      "delete_organisation_if_allowed",
      {
        p_organisation_id: organisationId,
        p_actor_id: actorId,
      },
    );
    if (error) {
      throw new OrganisationError(
        error.message.includes("active jobs")
          ? "conflict"
          : error.message.includes("Only the Owner")
            ? "forbidden"
            : "persistence_failure",
        error.message.includes("active jobs")
          ? "Resolve or cancel all active Organisation jobs first."
          : error.message.includes("Only the Owner")
            ? "Only the Owner can delete the Organisation."
            : "Unable to delete Organisation.",
      );
    }
  }

  async createInvitation(input: {
    organisationId: string;
    actorId: string;
    email: string;
    role: Exclude<OrganisationMemberRole, "owner">;
  }) {
    const db = createServiceClient();
    await db
      .from("organisation_invitations")
      .delete()
      .eq("organisation_id", input.organisationId)
      .ilike("email", input.email)
      .is("accepted_at", null)
      .lt("expires_at", new Date().toISOString());

    const { data: existingUser, error: profileError } = await db
      .from("profiles")
      .select("id")
      .ilike("email", input.email)
      .maybeSingle();
    if (profileError) {
      throw new OrganisationError(
        "persistence_failure",
        "Unable to check Organisation membership.",
      );
    }
    if (existingUser) {
      const { data: existingMember, error: membershipError } = await db
        .from("organisation_members")
        .select("user_id")
        .eq("organisation_id", input.organisationId)
        .eq("user_id", existingUser.id)
        .maybeSingle();
      if (membershipError) {
        throw new OrganisationError(
          "persistence_failure",
          "Unable to check Organisation membership.",
        );
      }
      if (existingMember) {
        throw new OrganisationError(
          "conflict",
          "This person is already a member.",
        );
      }
    }

    const { data: invitation, error: invitationError } = await db
      .from("organisation_invitations")
      .insert({
        organisation_id: input.organisationId,
        email: input.email,
        role: input.role,
        invited_by: input.actorId,
      })
      .select("token, expires_at")
      .single();
    if (invitationError || !invitation) {
      throw new OrganisationError(
        invitationError?.code === "23505"
          ? "conflict"
          : "persistence_failure",
        invitationError?.code === "23505"
          ? "A pending invitation already exists."
          : "Unable to create invitation.",
      );
    }

    const [{ data: organisation }, { data: inviter }] = await Promise.all([
      db
        .from("organisations")
        .select("name")
        .eq("id", input.organisationId)
        .single(),
      db
        .from("profiles")
        .select("full_name")
        .eq("id", input.actorId)
        .single(),
    ]);
    if (!organisation) {
      throw new OrganisationError(
        "not_found",
        "Organisation not found.",
      );
    }
    return {
      token: invitation.token,
      expiresAt: invitation.expires_at,
      organisationName: organisation.name,
      inviterName: inviter?.full_name ?? "A KingsHire member",
    };
  }

  async updateMemberRole(
    organisationId: string,
    userId: string,
    role: Exclude<OrganisationMemberRole, "owner">,
  ) {
    const { error } = await createServiceClient()
      .from("organisation_members")
      .update({ role })
      .eq("organisation_id", organisationId)
      .eq("user_id", userId);
    if (error) {
      throw new OrganisationError(
        "persistence_failure",
        "Unable to update member.",
      );
    }
  }

  async removeMember(organisationId: string, userId: string) {
    const { error } = await createServiceClient()
      .from("organisation_members")
      .delete()
      .eq("organisation_id", organisationId)
      .eq("user_id", userId);
    if (error) {
      throw new OrganisationError(
        "persistence_failure",
        "Unable to remove member.",
      );
    }
  }
}

export const organisationRepository = new SupabaseOrganisationRepository();
