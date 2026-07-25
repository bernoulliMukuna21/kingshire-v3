import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createOrganisation } from "@/modules/organisations/application/create-organisation";
import { organisationRepository } from "@/infrastructure/supabase/repositories/supabase-organisation-repository";
import { organisationErrorResponse } from "./organisation-http";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  try {
    const result = await createOrganisation(organisationRepository, {
      actorId: user.id,
      body,
    });
    return NextResponse.json(
      { id: result.organisationId },
      { status: 201 },
    );
  } catch (error) {
    const response = organisationErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
