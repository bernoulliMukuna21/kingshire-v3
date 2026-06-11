import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getOrCreateStripeAccount,
  createOnboardingLink,
  syncStripePayoutStatus,
} from "@/lib/stripe-connect";

// POST /api/stripe/connect-onboard
// Returns a fresh Stripe Connect Express onboarding URL for the current kinglancer.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "email, full_name, role, stripe_account_id, stripe_onboarding_complete",
    )
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "kinglancer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (profile.stripe_onboarding_complete) {
    return NextResponse.json({ alreadyConnected: true });
  }

  const accountId = await getOrCreateStripeAccount(
    user.id,
    profile.email,
    profile.stripe_account_id,
    profile.full_name,
  );

  const payoutStatus = await syncStripePayoutStatus({
    kinglancerId: user.id,
    accountId,
  });

  if (payoutStatus.payoutsEnabled) {
    return NextResponse.json({ alreadyConnected: true });
  }

  const url = await createOnboardingLink(accountId);

  return NextResponse.json({ url });
}
