import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";
import type { PlacementInput, PlacementStatus } from "@/lib/placements";

export type PlacementRow = Database["public"]["Tables"]["placements"]["Row"];
export type PlacementApplicationRow =
  Database["public"]["Tables"]["placement_applications"]["Row"];
export type PlacementAgreementRow =
  Database["public"]["Tables"]["placement_agreements"]["Row"];

export type PlacementApplicant = PlacementApplicationRow & {
  kinglancer: {
    full_name: string;
    avatar_url: string | null;
    location: string | null;
  } | null;
};

export type KinglancerApplication = PlacementApplicationRow & {
  placement: {
    id: string;
    title: string;
    organisation_id: string;
    status: string;
  } | null;
};

export type KinglancerAgreement = PlacementAgreementRow & {
  placement: { title: string } | null;
};

export async function createPlacement(params: {
  organisationId: string;
  createdBy: string;
  input: PlacementInput;
  requiresManualReview: boolean;
}): Promise<PlacementRow> {
  const db = createServiceClient();
  const { input } = params;
  const { data, error } = await db
    .from("placements")
    .insert({
      organisation_id: params.organisationId,
      created_by: params.createdBy,
      title: input.title,
      summary: input.summary,
      categories: input.categories,
      contribution: input.contribution,
      reward: input.reward,
      location: input.location,
      is_remote: input.isRemote,
      weekly_hours: input.weeklyHours,
      duration_weeks: input.durationWeeks,
      start_date: input.startDate,
      status: "draft",
      requires_manual_review: params.requiresManualReview,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PlacementRow;
}

export async function listOrganisationPlacements(
  organisationId: string,
): Promise<PlacementRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("placements")
    .select("*")
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PlacementRow[];
}

export async function getOrganisationPlacement(
  placementId: string,
  organisationId: string,
): Promise<PlacementRow | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("placements")
    .select("*")
    .eq("id", placementId)
    .eq("organisation_id", organisationId)
    .maybeSingle();
  return (data as PlacementRow | null) ?? null;
}

export async function countOpenPlacements(
  organisationId: string,
): Promise<number> {
  const db = createServiceClient();
  const { count } = await db
    .from("placements")
    .select("id", { count: "exact", head: true })
    .eq("organisation_id", organisationId)
    .eq("status", "open");
  return count ?? 0;
}

export async function countOrganisationPlacements(
  organisationId: string,
): Promise<number> {
  const db = createServiceClient();
  const { count } = await db
    .from("placements")
    .select("id", { count: "exact", head: true })
    .eq("organisation_id", organisationId);
  return count ?? 0;
}

export async function updatePlacementStatus(
  placementId: string,
  organisationId: string,
  status: PlacementStatus,
): Promise<PlacementRow | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("placements")
    .update({ status })
    .eq("id", placementId)
    .eq("organisation_id", organisationId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return (data as PlacementRow | null) ?? null;
}

// ── Discovery (kinglancer side) ───────────────────────────

export async function listOpenPlacements(): Promise<PlacementRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("placements")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as PlacementRow[];
}

export async function getOpenPlacement(
  placementId: string,
): Promise<PlacementRow | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("placements")
    .select("*")
    .eq("id", placementId)
    .eq("status", "open")
    .maybeSingle();
  return (data as PlacementRow | null) ?? null;
}

// ── Applications ──────────────────────────────────────────

export async function hasAppliedToPlacement(
  placementId: string,
  kinglancerId: string,
): Promise<boolean> {
  const db = createServiceClient();
  const { data } = await db
    .from("placement_applications")
    .select("id")
    .eq("placement_id", placementId)
    .eq("kinglancer_id", kinglancerId)
    .maybeSingle();
  return !!data;
}

export async function createPlacementApplication(params: {
  placementId: string;
  kinglancerId: string;
  message: string | null;
}): Promise<PlacementApplicationRow> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("placement_applications")
    .insert({
      placement_id: params.placementId,
      kinglancer_id: params.kinglancerId,
      message: params.message,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PlacementApplicationRow;
}

export async function getPlacementApplication(
  applicationId: string,
): Promise<PlacementApplicationRow | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("placement_applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();
  return (data as PlacementApplicationRow | null) ?? null;
}

export async function listPlacementApplicants(
  placementId: string,
): Promise<PlacementApplicant[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("placement_applications")
    .select(
      "*, kinglancer:profiles!kinglancer_id(full_name, avatar_url, location)",
    )
    .eq("placement_id", placementId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PlacementApplicant[];
}

export async function updatePlacementApplicationStatus(
  applicationId: string,
  status: PlacementApplicationRow["status"],
): Promise<void> {
  const db = createServiceClient();
  const { error } = await db
    .from("placement_applications")
    .update({ status })
    .eq("id", applicationId);
  if (error) throw error;
}

export async function listKinglancerApplications(
  kinglancerId: string,
): Promise<KinglancerApplication[]> {
  const db = createServiceClient();
  const { data } = await db
    .from("placement_applications")
    .select(
      "*, placement:placements(id, title, organisation_id, status)",
    )
    .eq("kinglancer_id", kinglancerId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as KinglancerApplication[];
}

// ── Agreements ────────────────────────────────────────────

export async function countReservedParticipants(
  organisationId: string,
): Promise<number> {
  const db = createServiceClient();
  const { count } = await db
    .from("placement_agreements")
    .select("id", { count: "exact", head: true })
    .eq("organisation_id", organisationId)
    .in("status", ["active", "pending_acceptance"]);
  return count ?? 0;
}

export async function createAgreementFromPlacement(params: {
  placement: PlacementRow;
  kinglancerId: string;
  orgSignedBy: string;
}): Promise<PlacementAgreementRow> {
  const db = createServiceClient();
  const { placement } = params;
  const { data, error } = await db
    .from("placement_agreements")
    .insert({
      placement_id: placement.id,
      organisation_id: placement.organisation_id,
      kinglancer_id: params.kinglancerId,
      contribution_terms: placement.contribution,
      reward_terms: placement.reward,
      weekly_hours: placement.weekly_hours,
      duration_weeks: placement.duration_weeks,
      status: "pending_acceptance",
      org_signed_by: params.orgSignedBy,
      org_signed_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as PlacementAgreementRow;
}

export async function getAgreement(
  agreementId: string,
): Promise<PlacementAgreementRow | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("placement_agreements")
    .select("*")
    .eq("id", agreementId)
    .maybeSingle();
  return (data as PlacementAgreementRow | null) ?? null;
}

/** Kinglancer signs a pending agreement; returns true if it became active. */
export async function activateAgreement(agreementId: string): Promise<boolean> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("placement_agreements")
    .update({ status: "active", kinglancer_signed_at: new Date().toISOString() })
    .eq("id", agreementId)
    .eq("status", "pending_acceptance")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function updateAgreementStatus(
  agreementId: string,
  status: PlacementAgreementRow["status"],
): Promise<void> {
  const db = createServiceClient();
  const { error } = await db
    .from("placement_agreements")
    .update({ status })
    .eq("id", agreementId);
  if (error) throw error;
}

export async function listKinglancerAgreements(
  kinglancerId: string,
): Promise<KinglancerAgreement[]> {
  const db = createServiceClient();
  const { data } = await db
    .from("placement_agreements")
    .select("*, placement:placements(title)")
    .eq("kinglancer_id", kinglancerId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as KinglancerAgreement[];
}

export async function listPlacementAgreements(
  placementId: string,
): Promise<PlacementAgreementRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("placement_agreements")
    .select("*")
    .eq("placement_id", placementId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PlacementAgreementRow[];
}
