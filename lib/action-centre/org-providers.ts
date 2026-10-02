import { getOrganisationMembership, hasOrganisationPermission } from "@/lib/organisations";
import { getPendingReviewJobs } from "@/lib/db/reviews";
import { createServiceClient } from "@/lib/supabase/service";
import { listPendingPlacementApplicationsForOrg } from "@/lib/db/placements";
import { listHeldPlacementPaymentsForOrg } from "@/lib/db/placement-payments";
import { listOrgPendingRoleOffers } from "@/lib/db/engagements";
import type { ActionCentreItem, ServerClient } from "./types";
import {
  buildReviewItems,
  buildOrgApplicationItems,
  buildOrgPlacementPaymentItems,
  buildOrgRoleOfferItems,
} from "./mappers";
import { fetchClientStyleJobItems } from "./personal-providers";

// ── Organisation actions (folded into the account Action Centre) ─
// Service reads are gated by a fresh membership check in the collector.

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

export async function collectOrgActionItems(
  organisationId: string,
  userId: string,
): Promise<ActionCentreItem[]> {
  const membership = await getOrganisationMembership(organisationId, userId);
  if (!membership) return [];

  const providers = [];
  if (hasOrganisationPermission(membership.role, "manage_jobs")) {
    providers.push(orgJobItems, orgPaymentItems, orgRoleOfferItems);
    providers.push(async (id: string) => buildReviewItems(
      await getPendingReviewJobs(userId, "client", id), "client", id,
    ));
  }
  if (hasOrganisationPermission(membership.role, "manage_applicants")) {
    providers.push(orgApplicationItems);
  }
  const results = await Promise.all(providers.map(provider => provider(organisationId)));
  return results.flat();
}
