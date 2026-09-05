import { createServiceClient } from "@/lib/supabase/service";

/**
 * Bump this when the platform terms change materially (e.g. fees). Non-admin
 * users on an older version are re-prompted to accept before their next
 * value action.
 */
export const CURRENT_TERMS_VERSION = 1;

export function hasAcceptedCurrentTerms(
  version: number | null | undefined,
): boolean {
  return (version ?? 0) >= CURRENT_TERMS_VERSION;
}

/**
 * Server guard for money actions: true if the user has accepted the current
 * terms (admins are exempt). Reads the profile with the service client.
 */
export async function requireTermsAccepted(userId: string): Promise<boolean> {
  const db = createServiceClient();
  const { data } = await db
    .from("profiles")
    .select("role, terms_accepted_version")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return false;
  if (data.role === "admin") return true;
  return hasAcceptedCurrentTerms(data.terms_accepted_version);
}
