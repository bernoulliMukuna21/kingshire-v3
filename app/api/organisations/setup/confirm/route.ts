import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fulfillOrganisationCheckout } from "@/infrastructure/stripe/organisation-subscriptions";
import { organisationErrorResponse } from "../../organisation-http";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const sessionId =
    body && typeof body === "object" && !Array.isArray(body)
      ? String((body as Record<string, unknown>).session_id ?? "")
      : "";

  if (!sessionId.startsWith("cs_")) {
    return NextResponse.json(
      { error: "Invalid Checkout Session." },
      { status: 400 },
    );
  }

  try {
    const result = await fulfillOrganisationCheckout(sessionId, user.id);
    return NextResponse.json({ organisation_id: result.organisationId });
  } catch (error) {
    const response = organisationErrorResponse(error);
    if (response) return response;
    console.error("Unable to confirm Organisation subscription:", error);
    return NextResponse.json(
      {
        error:
          "Stripe confirmation is temporarily unavailable. Your payment is safe and we will keep trying.",
        retryable: true,
      },
      { status: 503 },
    );
  }
}
