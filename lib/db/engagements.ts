import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";
import type {
  Cadence,
  EngagementSourceKind,
  EngagementStatus,
  SettlementMode,
} from "@/lib/settlement/types";

export type EngagementRow =
  Database["public"]["Tables"]["engagements"]["Row"];
export type EngagementInsert =
  Database["public"]["Tables"]["engagements"]["Insert"];

export type Engagement = Omit<EngagementRow, "cadence" | "settlement_mode" | "source_kind" | "status"> & {
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

export async function endEngagement(
  id: string,
  reason?: string,
): Promise<void> {
  const engagement = await updateEngagement(id, {
    status: "ended",
    ended_at: new Date().toISOString(),
    end_reason: reason ?? null,
  });
  if (!engagement) throw new Error("Engagement not found");
}
