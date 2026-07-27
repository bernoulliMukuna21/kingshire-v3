import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const draftId =
    body && typeof body === "object" && !Array.isArray(body)
      ? String((body as Record<string, unknown>).draft_id ?? "")
      : "";
  if (!draftId) {
    return NextResponse.json({ error: "Invalid setup draft." }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: draft, error } = await db
    .from("organisation_setup_drafts")
    .select("stripe_checkout_session_id, organisation_id")
    .eq("id", draftId)
    .eq("actor_id", user.id)
    .maybeSingle();
  if (error || !draft) {
    return NextResponse.json({ error: "Setup draft not found." }, { status: 404 });
  }
  if (draft.organisation_id) {
    return NextResponse.json(
      { error: "This Organisation is already active." },
      { status: 409 },
    );
  }

  if (draft.stripe_checkout_session_id) {
    const session = await stripe.checkout.sessions.retrieve(
      draft.stripe_checkout_session_id,
    );
    if (session.status === "open") {
      await stripe.checkout.sessions.expire(session.id);
    }
  }

  const { error: updateError } = await db
    .from("organisation_setup_drafts")
    .update({ status: "cancelled" })
    .eq("id", draftId)
    .eq("actor_id", user.id);
  if (updateError) {
    return NextResponse.json(
      { error: "Unable to close the cancelled Checkout Session." },
      { status: 500 },
    );
  }

  return NextResponse.json({ cancelled: true });
}
