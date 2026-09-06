import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { acceptOrganisationInvitation } from "@/modules/organisations/application/accept-invitation";
import { organisationRepository } from "@/infrastructure/supabase/repositories/supabase-organisation-repository";
import { organisationErrorResponse } from "@/app/api/organisations/organisation-http";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json(
      { error: "Sign in to accept this invitation." },
      { status: 401 },
    );
  }

  try {
    const result = await acceptOrganisationInvitation(
      organisationRepository,
      {
        token,
        actorId: user.id,
        actorEmail: user.email,
      },
    );
    return NextResponse.json({
      organisation_id: result.organisationId,
    });
  } catch (error) {
    const response = organisationErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
