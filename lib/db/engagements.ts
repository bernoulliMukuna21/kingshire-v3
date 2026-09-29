import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";
import type {
  Cadence,
  EngagementSourceKind,
  EngagementStatus,
  SettlementMode,
} from "@/lib/settlement/types";

export type EngagementRow = Database["public"]["Tables"]["engagements"]["Row"];
export type EngagementInsert =
  Database["public"]["Tables"]["engagements"]["Insert"];

export type Engagement = Omit<
  EngagementRow,
  "cadence" | "settlement_mode" | "source_kind" | "status"
> & {
  cadence: Cadence;
  settlement_mode: SettlementMode;
  source_kind: EngagementSourceKind;
  status: EngagementStatus;
};

function asEngagement(row: EngagementRow): Engagement {
  return row as Engagement;
}

export async function getEngagement(id: string): Promise<Engagement | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("engagements")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return asEngagement(data);
}

export async function getEngagementBySource(
  sourceKind: EngagementSourceKind,
  sourceId: string,
): Promise<Engagement | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("engagements")
    .select("*")
    .eq("source_kind", sourceKind)
    .eq("source_id", sourceId)
    .maybeSingle();

  if (error || !data) return null;
  return asEngagement(data);
}

/** Batch lookup used to enrich payment listings without one query per row. */
export async function getEngagementsByIds(
  ids: string[],
): Promise<Map<string, Engagement>> {
  if (ids.length === 0) return new Map();
  const db = createServiceClient();
  const { data, error } = await db
    .from("engagements")
    .select("*")
    .in("id", [...new Set(ids)]);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.id, asEngagement(row)]));
}

export async function createEngagement(
  input: EngagementInsert,
): Promise<Engagement> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("engagements")
    .insert(input)
    .select("*")
    .single();

  if (error) throw error;
  return asEngagement(data);
}

export async function updateEngagement(
  id: string,
  patch: Database["public"]["Tables"]["engagements"]["Update"],
  expectedStatus?: EngagementStatus,
): Promise<Engagement | null> {
  const db = createServiceClient();
  let query = db.from("engagements").update(patch).eq("id", id);
  if (expectedStatus) query = query.eq("status", expectedStatus);
  const { data, error } = await query.select("*").maybeSingle();

  if (error) throw error;
  return data ? asEngagement(data) : null;
}

/** Idempotent: a no-op if the engagement isn't (still) `pending_funding` —
 * safe to call speculatively after every first-period charge. */
export async function markEngagementActive(id: string): Promise<void> {
  await updateEngagement(
    id,
    { status: "active", started_at: new Date().toISOString() },
    "pending_funding",
  );
}

export type KinglancerRoleOffer = {
  engagementId: string;
  jobId: string;
  jobTitle: string;
  organisationName: string | null;
  status: EngagementStatus;
  amountPerPeriod: number | null;
  cadence: Cadence;
};

/** Organisation role offers/engagements awaiting the Kinglancer's response or
 * funding — the recurring-role counterpart of `listKinglancerAgreements`
 * (placements). `source_id` isn't a real FK (shared with placements), so job
 * titles and organisation names are resolved in a second batched read. */
export async function listKinglancerRoleOffers(
  kinglancerId: string,
): Promise<KinglancerRoleOffer[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("engagements")
    .select(
      "id, source_id, organisation_id, status, amount_per_period, cadence",
    )
    .eq("source_kind", "org_role")
    .eq("kinglancer_id", kinglancerId)
    .in("status", ["pending_acceptance", "pending_funding"]);
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const jobIds = [...new Set(rows.map((row) => row.source_id))];
  const orgIds = [...new Set(rows.map((row) => row.organisation_id))];
  const [{ data: jobs }, { data: orgs }] = await Promise.all([
    db.from("jobs").select("id, title").in("id", jobIds),
    db.from("organisations").select("id, name").in("id", orgIds),
  ]);
  const jobTitleById = new Map((jobs ?? []).map((j) => [j.id, j.title]));
  const orgNameById = new Map((orgs ?? []).map((o) => [o.id, o.name]));

  return rows.map((row) => ({
    engagementId: row.id,
    jobId: row.source_id,
    jobTitle: jobTitleById.get(row.source_id) ?? "Role",
    organisationName: orgNameById.get(row.organisation_id) ?? null,
    status: row.status as EngagementStatus,
    amountPerPeriod:
      row.amount_per_period == null ? null : Number(row.amount_per_period),
    cadence: row.cadence as Cadence,
  }));
}

export type OrgPendingRoleOffer = {
  engagementId: string;
  jobId: string;
  jobTitle: string;
  kinglancerName: string | null;
  orgSignedAt: string | null;
  status: EngagementStatus;
};

/** Role offers an organisation has sent that are awaiting the Kinglancer's
 * response (`pending_acceptance` — "waiting on others", mirroring a sent
 * direct request) or already accepted and awaiting the org's own funding
 * action (`pending_funding` — first-period funding is always explicit, see
 * billing.ts, so this is a genuine action, not a wait). */
export async function listOrgPendingRoleOffers(
  organisationId: string,
): Promise<OrgPendingRoleOffer[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("engagements")
    .select("id, source_id, kinglancer_id, org_signed_at, status")
    .eq("source_kind", "org_role")
    .eq("organisation_id", organisationId)
    .in("status", ["pending_acceptance", "pending_funding"]);
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const jobIds = [...new Set(rows.map((row) => row.source_id))];
  const kinglancerIds = [...new Set(rows.map((row) => row.kinglancer_id))];
  const [{ data: jobs }, { data: profiles }] = await Promise.all([
    db.from("jobs").select("id, title").in("id", jobIds),
    db.from("profiles").select("id, full_name").in("id", kinglancerIds),
  ]);
  const jobTitleById = new Map((jobs ?? []).map((j) => [j.id, j.title]));
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return rows.map((row) => ({
    engagementId: row.id,
    jobId: row.source_id,
    jobTitle: jobTitleById.get(row.source_id) ?? "Role",
    kinglancerName: nameById.get(row.kinglancer_id) ?? null,
    orgSignedAt: row.org_signed_at,
    status: row.status as EngagementStatus,
  }));
}

export type EngagementCheckIn = {
  id: string;
  engagementId: string;
  authorId: string;
  authorName: string | null;
  note: string;
  createdAt: string;
};

/** Generic check-in feed shared by any engagement (currently roles; the
 * natural next step is migrating placements onto this instead of their own
 * placement_check_ins table). */
export async function listEngagementCheckIns(
  engagementId: string,
): Promise<EngagementCheckIn[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("engagement_check_ins")
    .select("id, engagement_id, author_id, note, created_at, author:profiles!author_id(full_name)")
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    engagementId: row.engagement_id,
    authorId: row.author_id,
    authorName:
      (row.author as unknown as { full_name: string | null } | null)
        ?.full_name ?? null,
    note: row.note,
    createdAt: row.created_at,
  }));
}

export async function createEngagementCheckIn(params: {
  engagementId: string;
  authorId: string;
  note: string;
}): Promise<void> {
  const db = createServiceClient();
  const { error } = await db.from("engagement_check_ins").insert({
    engagement_id: params.engagementId,
    author_id: params.authorId,
    note: params.note,
  });
  if (error) throw error;
}
