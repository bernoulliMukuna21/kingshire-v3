import { scopeActionCentre } from "./view";
import { dedupeById } from "./mappers";
import { PROVIDERS } from "./personal-providers";
import { collectOrgActionItems } from "./org-providers";
import type {
  AccountOrganisation,
  ActionCentre,
  ActionCentreRole,
  ServerClient,
} from "./types";

export * from "./types";
export * from "./mappers";
export * from "./personal-providers";
export * from "./org-providers";

/**
 * Single source of truth for "what needs my attention".
 *
 * Every surface — the Action Centre page AND the dashboard summary cards —
 * derives from `getAccountActionCentre`. The counts are the length of the
 * same list the page renders, so they can never drift. To add a new kind of
 * action, add or extend a provider; the list, the counts, and every surface
 * update together.
 *
 * The single, account-level Action Centre for the logged-in user: their own
 * role actions PLUS the actions for every organisation they belong to, each
 * tagged with its workspace name. This is what the sidebar + dashboard land on.
 */
export async function getAccountActionCentre(ctx: {
  supabase: ServerClient;
  userId: string;
  role: ActionCentreRole;
  organisations: AccountOrganisation[];
}): Promise<ActionCentre> {
  const [personalResults, orgResults] = await Promise.all([
    Promise.all(
      PROVIDERS[ctx.role].map((provider) =>
        provider({
          supabase: ctx.supabase,
          userId: ctx.userId,
          role: ctx.role,
        }),
      ),
    ),
    Promise.all(
      ctx.organisations.map(async (org) => {
        const items = await collectOrgActionItems(org.id, ctx.userId);
        return items.map((item) => ({ ...item, context: org.name, workspaceId: org.id }));
      }),
    ),
  ]);
  const items = dedupeById([...personalResults.flat().map(item => ({ ...item, context: "Personal workspace", workspaceId: null })), ...orgResults.flat()]);
  return scopeActionCentre(items);
}
