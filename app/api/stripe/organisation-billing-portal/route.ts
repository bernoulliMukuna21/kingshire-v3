import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrganisationPermission } from "@/modules/organisations/application/permissions";
import { organisationRepository } from "@/infrastructure/supabase/repositories/supabase-organisation-repository";
import { ensureOrganisationPortalConfiguration } from "@/infrastructure/stripe/organisation-subscriptions";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const organisationId =
    body && typeof body === "object" && !Array.isArray(body)
      ? String((body as Record<string, unknown>).organisation_id ?? "")
      : "";
  if (!organisationId) {
    return NextResponse.json(
      { error: "Organisation is required." },
      { status: 400 },
    );
  }

  const membership = await requireOrganisationPermission(
    organisationRepository,
    organisationId,
    user.id,
    "manage_billing",
  );
  if (!membership) {
    return NextResponse.json(
      { error: "Only the Organisation Owner can manage billing." },
      { status: 403 },
    );
  }

  const { data: subscription, error } = await createServiceClient()
    .from("organisation_subscriptions")
    .select("stripe_customer_id")
    .eq("organisation_id", organisationId)
    .maybeSingle();
  if (error || !subscription) {
    return NextResponse.json(
      { error: "No Organisation subscription was found." },
      { status: 404 },
    );
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    process.env.APP_URL?.replace(/\/$/, "") ??
    new URL(request.url).origin;
  try {
    const configuration = await ensureOrganisationPortalConfiguration();
    const portal = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      configuration,
      return_url: `${appUrl}/dashboard/organisations/${organisationId}`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (portalError) {
    console.error("Unable to open Stripe billing portal:", portalError);
    return NextResponse.json(
      { error: "Unable to open subscription management right now." },
      { status: 502 },
    );
  }
}
