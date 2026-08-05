import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";
import type { PlacementInput, PlacementStatus } from "@/lib/placements";

export type PlacementRow = Database["public"]["Tables"]["placements"]["Row"];

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
