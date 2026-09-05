import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createOrganisationCheckout } from "@/infrastructure/stripe/organisation-subscriptions";
import { parseOrganisationSetup } from "@/modules/organisations/schemas/organisation-setup";
import { organisationErrorResponse } from "../../organisation-http";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  try {
    const setup = parseOrganisationSetup(body);
    const result = await createOrganisationCheckout({
      actorId: user.id,
      actorEmail: user.email,
      requestKey: setup.requestKey,
      profile: setup.profile,
      planId: setup.planId,
      requestUrl: request.url,
    });

    return NextResponse.json(result);
  } catch (error) {
    const response = organisationErrorResponse(error);
    if (response) return response;
    console.error("Unable to create Organisation Checkout Session:", error);
    return NextResponse.json(
      { error: "Unable to start secure checkout. Please try again." },
      { status: 502 },
    );
  }
}
