import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  deleteOrganisation,
  transferOrganisationOwnership,
  updateOrganisation,
} from "@/modules/organisations/application/update-organisation";
import { organisationRepository } from "@/infrastructure/supabase/repositories/supabase-organisation-repository";
import { organisationErrorResponse } from "../organisation-http";

async function authenticatedUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const actorId = await authenticatedUserId();
  if (!actorId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);

  try {
    if (
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      body.action === "transfer_ownership"
    ) {
      await transferOrganisationOwnership(organisationRepository, {
        organisationId: id,
        actorId,
        newOwnerId: String(body.user_id ?? ""),
      });
    } else {
      await updateOrganisation(organisationRepository, {
        organisationId: id,
        actorId,
        body,
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const response = organisationErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const actorId = await authenticatedUserId();
  if (!actorId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  try {
    await deleteOrganisation(organisationRepository, {
      organisationId: id,
      actorId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const response = organisationErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
