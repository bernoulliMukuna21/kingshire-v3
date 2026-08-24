import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";
import type { PlacementInput, PlacementStatus } from "@/lib/placements";
import {
  managedMonthlyAmount,
  summarizePlacementCompensation,
} from "@/lib/placements";

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
  placement: { title: string; status: string } | null;
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
      location: input.location,
      is_remote: input.workMode === "remote",
      work_mode: input.workMode,
      days_on_site: input.daysOnSite,
      compensation_types: input.compensationTypes,
      compensation_details: input.compensationDetails,
      weekly_hours: input.weeklyHours,
      duration_weeks: input.durationWeeks,
      start_date: input.startDate,
      end_date: input.endDate,
      status: params.requiresManualReview ? "pending_review" : "open",
      requires_manual_review: params.requiresManualReview,
      payment_mode: input.paymentMode,
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

/** Cancel any still-pending offers when a placement is cancelled. */
export async function cancelPendingAgreementsForPlacement(
  placementId: string,
): Promise<void> {
  const db = createServiceClient();
  await db
    .from("placement_agreements")
    .update({ status: "cancelled" })
    .eq("placement_id", placementId)
    .eq("status", "pending_acceptance");
}

/** Whether any participant agreement (any status) exists for a placement. */
export async function placementHasAgreements(
  placementId: string,
): Promise<boolean> {
  const db = createServiceClient();
  const { count } = await db
    .from("placement_agreements")
    .select("id", { count: "exact", head: true })
    .eq("placement_id", placementId);
  return (count ?? 0) > 0;
}

/** Active-participant count per placement for an organisation. */
export async function activeParticipantCountsByPlacement(
  organisationId: string,
): Promise<Record<string, number>> {
  const db = createServiceClient();
  const { data } = await db
    .from("placement_agreements")
    .select("placement_id")
    .eq("organisation_id", organisationId)
    .eq("status", "active");
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { placement_id: string }[]) {
    counts[row.placement_id] = (counts[row.placement_id] ?? 0) + 1;
  }
  return counts;
}

/** Permanently delete a placement (guarded by the caller). */
export async function deletePlacement(
  placementId: string,
  organisationId: string,
): Promise<void> {
  const db = createServiceClient();
  const { error } = await db
    .from("placements")
    .delete()
    .eq("id", placementId)
    .eq("organisation_id", organisationId);
  if (error) throw error;
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

export type PublicPlacement = PlacementRow & {
  organisation: { name: string } | null;
};

export async function listPublicPlacements(): Promise<PublicPlacement[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("placements")
    .select("*, organisation:organisations!inner(name)")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as PublicPlacement[];
}

export async function getPublicPlacement(
  placementId: string,
): Promise<PublicPlacement | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("placements")
    .select("*, organisation:organisations!inner(name)")
    .eq("id", placementId)
    .eq("status", "open")
    .maybeSingle();
  return (data as unknown as PublicPlacement | null) ?? null;
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
  cvUrl: string | null;
}): Promise<PlacementApplicationRow> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("placement_applications")
    .insert({
      placement_id: params.placementId,
      kinglancer_id: params.kinglancerId,
      message: params.message,
      cv_url: params.cvUrl,
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
    .select("*, placement:placements(id, title, organisation_id, status)")
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
      reward_terms:
        summarizePlacementCompensation(placement) ||
        placement.reward ||
        "Supervised experience, mentoring and a verified record.",
      weekly_hours: placement.weekly_hours,
      duration_weeks: placement.duration_weeks,
      status: "pending_acceptance",
      org_signed_by: params.orgSignedBy,
      org_signed_at: new Date().toISOString(),
      payment_mode: placement.payment_mode,
      monthly_amount: managedMonthlyAmount(placement),
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
    .update({
      status: "active",
      kinglancer_signed_at: new Date().toISOString(),
    })
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
    .select("*, placement:placements(title, status)")
    .eq("kinglancer_id", kinglancerId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as KinglancerAgreement[];
}

export type PlacementParticipant = PlacementAgreementRow & {
  kinglancer: { full_name: string; avatar_url: string | null } | null;
};

export async function listPlacementAgreements(
  placementId: string,
): Promise<PlacementParticipant[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("placement_agreements")
    .select("*, kinglancer:profiles!kinglancer_id(full_name, avatar_url)")
    .eq("placement_id", placementId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PlacementParticipant[];
}

// ── Milestones, check-ins, completion (Placement Passport) ─

export type PlacementMilestoneRow =
  Database["public"]["Tables"]["placement_milestones"]["Row"];
export type PlacementCheckInRow =
  Database["public"]["Tables"]["placement_check_ins"]["Row"];
export type PlacementCheckIn = PlacementCheckInRow & {
  author: { full_name: string } | null;
};
export type ExperienceRecordRow =
  Database["public"]["Tables"]["experience_records"]["Row"];

export async function listMilestones(
  agreementId: string,
): Promise<PlacementMilestoneRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("placement_milestones")
    .select("*")
    .eq("agreement_id", agreementId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PlacementMilestoneRow[];
}

export async function createMilestone(params: {
  agreementId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
}): Promise<PlacementMilestoneRow> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("placement_milestones")
    .insert({
      agreement_id: params.agreementId,
      title: params.title,
      description: params.description,
      due_date: params.dueDate,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PlacementMilestoneRow;
}

export async function getMilestone(
  milestoneId: string,
): Promise<PlacementMilestoneRow | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("placement_milestones")
    .select("*")
    .eq("id", milestoneId)
    .maybeSingle();
  return (data as PlacementMilestoneRow | null) ?? null;
}

export async function confirmMilestone(
  milestoneId: string,
  confirmedBy: string,
): Promise<void> {
  const db = createServiceClient();
  const { error } = await db
    .from("placement_milestones")
    .update({
      status: "confirmed",
      confirmed_by: confirmedBy,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", milestoneId)
    .eq("status", "pending");
  if (error) throw error;
}

export async function listCheckIns(
  agreementId: string,
): Promise<PlacementCheckIn[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("placement_check_ins")
    .select("*, author:profiles!author_id(full_name)")
    .eq("agreement_id", agreementId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PlacementCheckIn[];
}

export async function createCheckIn(params: {
  agreementId: string;
  authorId: string;
  note: string;
}): Promise<PlacementCheckInRow> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("placement_check_ins")
    .insert({
      agreement_id: params.agreementId,
      author_id: params.authorId,
      note: params.note,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PlacementCheckInRow;
}

/** Marks an active agreement completed; returns true if it was active. */
export async function completeAgreement(agreementId: string): Promise<boolean> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("placement_agreements")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", agreementId)
    .eq("status", "active")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function createExperienceRecord(params: {
  agreement: PlacementAgreementRow;
  title: string;
  summary: string | null;
  skills: string[];
  outcome: string | null;
  referenceText: string | null;
  isPublic: boolean;
}): Promise<ExperienceRecordRow> {
  const db = createServiceClient();
  const { agreement } = params;
  const { data, error } = await db
    .from("experience_records")
    .insert({
      agreement_id: agreement.id,
      placement_id: agreement.placement_id,
      organisation_id: agreement.organisation_id,
      kinglancer_id: agreement.kinglancer_id,
      title: params.title,
      summary: params.summary,
      skills: params.skills,
      outcome: params.outcome,
      reference_text: params.referenceText,
      is_public: params.isPublic,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ExperienceRecordRow;
}

export type PublicExperienceRecord = ExperienceRecordRow & {
  organisation: { name: string } | null;
};

export async function listPublicExperienceRecords(
  kinglancerId: string,
): Promise<PublicExperienceRecord[]> {
  const db = createServiceClient();
  const { data } = await db
    .from("experience_records")
    .select("*, organisation:organisations(name)")
    .eq("kinglancer_id", kinglancerId)
    .eq("is_public", true)
    .order("completed_at", { ascending: false });
  return (data ?? []) as unknown as PublicExperienceRecord[];
}

export async function getPlacementTitle(
  placementId: string,
): Promise<string | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("placements")
    .select("title")
    .eq("id", placementId)
    .maybeSingle();
  return (data?.title as string | undefined) ?? null;
}

// ── Admin review ──────────────────────────────────────────

export type PlacementForReview = PlacementRow & {
  organisation: { name: string } | null;
};

export async function listPlacementsForReview(): Promise<PlacementForReview[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("placements")
    .select("*, organisation:organisations(name)")
    .eq("status", "pending_review")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PlacementForReview[];
}

/** Admin approves (→open) or rejects (→cancelled) a placement in review. */
export async function adminReviewPlacement(
  placementId: string,
  status: "open" | "cancelled",
): Promise<boolean> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("placements")
    .update({ status })
    .eq("id", placementId)
    .eq("status", "pending_review")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return !!data;
}
