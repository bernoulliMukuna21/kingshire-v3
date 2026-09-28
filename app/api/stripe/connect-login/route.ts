import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { stripe } from "@/lib/stripe";

// POST /api/stripe/connect-login
// Returns a one-time Stripe Express Login Link for the authenticated kinglancer.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // stripe_account_id/stripe_onboarding_complete are restricted from
  // anon/authenticated (migration 069) — use the service client for this
  // owner-scoped read.
  const db = createServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("role, stripe_account_id, stripe_onboarding_complete")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "kinglancer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!profile.stripe_account_id) {
    return NextResponse.json(
      { error: "No Stripe account linked yet" },
      { status: 400 },
    );
  }

  const loginLink = await stripe.accounts.createLoginLink(
    profile.stripe_account_id,
  );

  return NextResponse.json({ url: loginLink.url });
}
