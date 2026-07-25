import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  removeOrganisationMember,
  updateOrganisationMemberRole,
} from "@/modules/organisations/application/manage-member";
import { parseMemberRoleUpdate } from "@/modules/organisations/schemas/member-role";
import { organisationRepository } from "@/infrastructure/supabase/repositories/supabase-organisation-repository";
import { organisationErrorResponse } from "../../../organisation-http";

async function authenticatedUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await params;
  const actorId = await authenticatedUserId();
  if (!actorId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  try {
    const result = await updateOrganisationMemberRole(
      organisationRepository,
      {
        organisationId: id,
        actorId,
        targetUserId: userId,
        role: parseMemberRoleUpdate(body),
      },
    );
    return NextResponse.json(result);
  } catch (error) {
    const response = organisationErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const { id, userId } = await params;
  const actorId = await authenticatedUserId();
  if (!actorId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  try {
    await removeOrganisationMember(organisationRepository, {
      organisationId: id,
      actorId,
      targetUserId: userId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const response = organisationErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
