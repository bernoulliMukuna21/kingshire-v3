import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { emailOrganisationInvitation } from "@/lib/notifications";
import { inviteOrganisationMember } from "@/modules/organisations/application/invite-member";
import { organisationRepository } from "@/infrastructure/supabase/repositories/supabase-organisation-repository";
import { organisationErrorResponse } from "../../organisation-http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const invitation = await inviteOrganisationMember(
      organisationRepository,
      {
        organisationId: id,
        actorId: user.id,
        body: await request.json().catch(() => null),
      },
    );
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const invitationUrl =
      `${baseUrl}/organisation-invitations/${invitation.token}`;

    emailOrganisationInvitation({
      to: invitation.email,
      organisationName: invitation.organisationName,
      inviterName: invitation.inviterName,
      invitationUrl,
    }).catch((error) =>
      console.error("[organisation-invitation-email]", error),
    );

    return NextResponse.json(
      {
        invitation_url: invitationUrl,
        expires_at: invitation.expiresAt,
      },
      { status: 201 },
    );
  } catch (error) {
    const response = organisationErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
