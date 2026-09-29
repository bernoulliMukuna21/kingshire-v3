import type { ActionCentre, ActionCentreItem } from "./types";

/** Counts and rendered items always share the same workspace selection. */
export function scopeActionCentre(items: ActionCentreItem[], workspace = "all"): ActionCentre {
  const selected = items.filter(item => workspace === "all" ||
    (workspace === "personal" ? !item.workspaceId : item.workspaceId === workspace));
  return {
    items: selected,
    actionCount: selected.filter(item => item.kind === "action").length,
    waitingCount: selected.filter(item => item.kind === "waiting").length,
  };
}
