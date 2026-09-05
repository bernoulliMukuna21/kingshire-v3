// Shared helpers for status-driven tab bars (jobs, placements, etc.), so each
// page declares its tabs once instead of re-implementing parse + count boilerplate.

/** Returns `raw` if it's a known tab, otherwise the fallback. */
export function resolveTab<T extends string>(
  order: readonly T[],
  raw: string | undefined,
  fallback: T,
): T {
  return order.includes(raw as T) ? (raw as T) : fallback;
}

/** Count how many items fall under each tab, given a matcher. */
export function countTabs<T extends string, Item>(
  order: readonly T[],
  items: Item[],
  matches: (tab: T, item: Item) => boolean,
): Record<T, number> {
  const counts = {} as Record<T, number>;
  for (const t of order) counts[t] = items.filter((i) => matches(t, i)).length;
  return counts;
}

/**
 * A matcher for the common case where a tab maps to a list of statuses and an
 * empty list means "all". Use with `countTabs`.
 */
export function statusTabMatcher<T extends string>(
  statuses: Record<T, string[]>,
): (tab: T, item: { status: string }) => boolean {
  return (tab, item) =>
    statuses[tab].length === 0 || statuses[tab].includes(item.status);
}
