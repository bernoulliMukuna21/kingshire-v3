import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getOrganisationPlan,
  type OrganisationPlanId,
} from "@/modules/organisations/domain/plans";
import type { OrganisationProfileInput } from "@/modules/organisations/domain/types";
import { OrganisationError } from "@/modules/organisations/domain/errors";

const CHECKOUT_PURPOSE = "organisation_subscription";

const PRICE_ENV_BY_PLAN: Record<OrganisationPlanId, string> = {
  starter: "STRIPE_ORGANISATION_STARTER_PRICE_ID",
  growth: "STRIPE_ORGANISATION_GROWTH_PRICE_ID",
  scale: "STRIPE_ORGANISATION_SCALE_PRICE_ID",
};

type SetupDraftRow = {
  id: string;
  actor_id: string;
  stripe_checkout_session_id: string | null;
  organisation_id: string | null;
};

export type OrganisationCheckoutResult = {
  organisationId: string;
  alreadyActive: boolean;
};

function getPriceId(planId: OrganisationPlanId) {
  const environmentName = PRICE_ENV_BY_PLAN[planId];
  const priceId = process.env[environmentName]?.trim();
  if (!priceId) {
    throw new OrganisationError(
      "persistence_failure",
      `${getOrganisationPlan(planId).name} billing is not configured.`,
    );
  }
  return priceId;
}

function publicAppUrl(requestUrl: string) {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    process.env.APP_URL?.replace(/\/$/, "") ??
    new URL(requestUrl).origin
  );
}

async function findExistingDraft(actorId: string, requestKey: string) {
  const { data, error } = await createServiceClient()
    .from("organisation_setup_drafts")
    .select(
      "id, actor_id, stripe_checkout_session_id, organisation_id",
    )
    .eq("actor_id", actorId)
    .eq("request_key", requestKey)
    .maybeSingle();

  if (error) {
    throw new OrganisationError(
      "persistence_failure",
      "Unable to resume Organisation setup.",
    );
  }
  return data as SetupDraftRow | null;
}

export async function createOrganisationCheckout(input: {
  actorId: string;
  actorEmail: string;
  requestKey: string;
  profile: OrganisationProfileInput;
  planId: OrganisationPlanId;
  requestUrl: string;
}) {
  const db = createServiceClient();
  const existing = await findExistingDraft(input.actorId, input.requestKey);

  if (existing?.organisation_id) {
    return {
      organisationId: existing.organisation_id,
      checkoutUrl: null,
    };
  }

  if (existing?.stripe_checkout_session_id) {
    const session = await stripe.checkout.sessions.retrieve(
      existing.stripe_checkout_session_id,
    );
    if (session.status === "open" && session.url) {
      return { organisationId: null, checkoutUrl: session.url };
    }
  }

  const priceId = getPriceId(input.planId);
  const plan = getOrganisationPlan(input.planId);
  const stripePrice = await stripe.prices.retrieve(priceId);
  if (
    !stripePrice.active ||
    stripePrice.currency.toLowerCase() !== "gbp" ||
    stripePrice.unit_amount !== plan.monthlyPriceGBP * 100 ||
    stripePrice.recurring?.interval !== "month" ||
    stripePrice.recurring.interval_count !== 1
  ) {
    throw new OrganisationError(
      "persistence_failure",
      `${plan.name} is not configured as a £${plan.monthlyPriceGBP} monthly Stripe price.`,
    );
  }
  let draftId = existing?.id;

  if (!draftId) {
    const { data: draft, error } = await db
      .from("organisation_setup_drafts")
      .insert({
        request_key: input.requestKey,
        actor_id: input.actorId,
        name: input.profile.name,
        organisation_type: input.profile.organisationType,
        description: input.profile.description,
        country: input.profile.country,
        location: input.profile.location,
        website: input.profile.website,
        registration_number: input.profile.registrationNumber,
        selected_plan: input.planId,
        stripe_price_id: priceId,
      })
      .select("id")
      .single();

    if (error || !draft) {
      throw new OrganisationError(
        error?.code === "23505" ? "conflict" : "persistence_failure",
        error?.code === "23505"
          ? "This setup is already being processed."
          : "Unable to save Organisation setup.",
      );
    }
    draftId = draft.id;
  }
  if (!draftId) {
    throw new OrganisationError(
      "persistence_failure",
      "Organisation setup draft was not created.",
    );
  }

  const appUrl = publicAppUrl(input.requestUrl);
  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer_email: input.actorEmail,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: draftId,
      metadata: {
        purpose: CHECKOUT_PURPOSE,
        organisation_setup_draft_id: draftId,
        actor_id: input.actorId,
        plan_id: input.planId,
      },
      subscription_data: {
        metadata: {
          purpose: CHECKOUT_PURPOSE,
          organisation_setup_draft_id: draftId,
          actor_id: input.actorId,
          plan_id: input.planId,
        },
      },
      success_url: `${appUrl}/organisation/setup/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/organisation/setup?draft_id=${draftId}&cancelled=1`,
    },
    { idempotencyKey: `organisation-setup-${input.requestKey}` },
  );

  if (!session.url) {
    throw new OrganisationError(
      "persistence_failure",
      "Stripe did not provide a checkout URL.",
    );
  }

  const { error: updateError } = await db
    .from("organisation_setup_drafts")
    .update({
      stripe_checkout_session_id: session.id,
      status: "checkout_pending",
    })
    .eq("id", draftId)
    .eq("actor_id", input.actorId);

  if (updateError) {
    await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
    throw new OrganisationError(
      "persistence_failure",
      "Unable to link payment to Organisation setup.",
    );
  }

  return { organisationId: null, checkoutUrl: session.url };
}

function getExpandedId(
  value: string | { id: string } | null,
  label: string,
) {
  const id = typeof value === "string" ? value : value?.id;
  if (!id) {
    throw new OrganisationError(
      "persistence_failure",
      `Stripe ${label} is missing.`,
    );
  }
  return id;
}

export async function fulfillOrganisationCheckout(
  checkoutSessionId: string,
  expectedActorId?: string,
): Promise<OrganisationCheckoutResult> {
  const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
    expand: ["subscription", "customer"],
  });

  if (
    session.metadata?.purpose !== CHECKOUT_PURPOSE ||
    !session.metadata.organisation_setup_draft_id ||
    !session.metadata.actor_id
  ) {
    throw new OrganisationError(
      "not_found",
      "Organisation checkout was not found.",
    );
  }
  if (
    expectedActorId &&
    session.metadata.actor_id !== expectedActorId
  ) {
    throw new OrganisationError(
      "forbidden",
      "This checkout belongs to another account.",
    );
  }
  if (
    session.status !== "complete" ||
    session.payment_status === "unpaid"
  ) {
    throw new OrganisationError(
      "conflict",
      "The subscription payment has not completed.",
    );
  }

  const subscription =
    typeof session.subscription === "string"
      ? await stripe.subscriptions.retrieve(session.subscription)
      : session.subscription;
  if (
    !subscription ||
    (subscription.status !== "active" && subscription.status !== "trialing")
  ) {
    throw new OrganisationError(
      "conflict",
      "The Organisation subscription is not active yet.",
    );
  }

  const db = createServiceClient();
  const draftId = session.metadata.organisation_setup_draft_id;
  const { data: draft, error: draftError } = await db
    .from("organisation_setup_drafts")
    .select("organisation_id")
    .eq("id", draftId)
    .eq("actor_id", session.metadata.actor_id)
    .single();

  if (draftError || !draft) {
    throw new OrganisationError(
      "not_found",
      "Organisation setup was not found.",
    );
  }
  if (draft.organisation_id) {
    return {
      organisationId: draft.organisation_id,
      alreadyActive: true,
    };
  }

  const customerId = getExpandedId(session.customer, "customer");
  const { data: organisationId, error } = await db.rpc(
    "activate_organisation_setup",
    {
      p_draft_id: draftId,
      p_actor_id: session.metadata.actor_id,
      p_stripe_checkout_session_id: session.id,
      p_stripe_customer_id: customerId,
      p_stripe_subscription_id: subscription.id,
      p_subscription_status: subscription.status,
    },
  );

  if (error || typeof organisationId !== "string") {
    throw new OrganisationError(
      "persistence_failure",
      "Unable to activate the Organisation.",
    );
  }
  const currentPeriodEnd =
    subscription.items.data[0]?.current_period_end;
  if (currentPeriodEnd) {
    await db
      .from("organisation_subscriptions")
      .update({
        current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
      })
      .eq("organisation_id", organisationId);
  }

  return { organisationId, alreadyActive: false };
}

export async function syncOrganisationSubscription(
  subscription: Stripe.Subscription,
) {
  const priceId = subscription.items.data[0]?.price.id;
  const update: {
    status: Stripe.Subscription.Status;
    cancel_at_period_end: boolean;
    stripe_price_id?: string;
    plan?: OrganisationPlanId;
    current_period_end?: string;
  } = {
    status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end,
  };
  if (priceId) {
    update.stripe_price_id = priceId;
    const matchingPlan = (
      Object.entries(PRICE_ENV_BY_PLAN) as Array<
        [OrganisationPlanId, string]
      >
    ).find(([, environmentName]) => process.env[environmentName] === priceId);
    if (matchingPlan) update.plan = matchingPlan[0];
  }
  const currentPeriodEnd =
    subscription.items.data[0]?.current_period_end;
  if (currentPeriodEnd) {
    update.current_period_end = new Date(
      currentPeriodEnd * 1000,
    ).toISOString();
  }

  const { error } = await createServiceClient()
    .from("organisation_subscriptions")
    .update(update)
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    throw new Error(
      `Unable to sync Organisation subscription ${subscription.id}: ${error.message}`,
    );
  }
}
