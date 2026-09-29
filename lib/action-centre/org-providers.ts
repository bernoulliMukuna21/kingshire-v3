import { createServiceClient } from "@/lib/supabase/service";
import { listPendingPlacementApplicationsForOrg } from "@/lib/db/placements";
import { listHeldPlacementPaymentsForOrg } from "@/lib/db/placement-payments";
import { listOrgPendingRoleOffers } from "@/lib/db/engagements";
import type { ActionCentreItem, ServerClient } from "./types";
import {
  buildOrgApplicationItems,
  buildOrgPlacementPaymentItems,
  buildOrgRoleOfferItems,
} from "./mappers";
import { fetchClientStyleJobItems } from "./personal-providers";

// ── Organisation actions (folded into the account Action Centre) ─
// Org-wide reads use the service client (bypasses RLS); membership is verified
// by the caller — the dashboard context only lists the user's own workspaces.

async function orgJobItems(
  organisationId: string,
): Promise<ActionCentreItem[]> {
  return fetchClientStyleJobItems(
    createServiceClient() as unknown as ServerClient,
    "organisation_id",
    organisationId,
  );
}

async function orgPaymentItems(
  organisationId: string,
): Promise<ActionCentreItem[]> {
  const payments = await listHeldPlacementPaymentsForOrg(organisationId);
  return buildOrgPlacementPaymentItems(payments);
}

async function orgApplicationItems(
  organisationId: string,
): Promise<ActionCentreItem[]> {
  const applications =
    await listPendingPlacementApplicationsForOrg(organisationId);
  return buildOrgApplicationItems(applications, organisationId);
}

// Visibility, not action — a sent role offer needs no org response, but it
// should still show up as "waiting on others" the same way a sent direct
// request does, instead of disappearing until the Kinglancer replies.
async function orgRoleOfferItems(
  organisationId: string,
): Promise<ActionCentreItem[]> {
  const offers = await listOrgPendingRoleOffers(organisationId);
  return buildOrgRoleOfferItems(offers, organisationId);
}

const ORGANISATION_PROVIDERS = [
  orgJobItems,
  orgPaymentItems,
  orgApplicationItems,
  orgRoleOfferItems,
];

export async function collectOrgActionItems(
  organisationId: string,
): Promise<ActionCentreItem[]> {
  const results = await Promise.all(
    ORGANISATION_PROVIDERS.map((provider) => provider(organisationId)),
  );
  return results.flat();
}
