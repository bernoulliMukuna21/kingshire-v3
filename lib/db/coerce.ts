/**
 * Postgres `numeric` columns are returned as STRINGS by supabase-js, yet the
 * generated types annotate them as `number`. That mismatch silently turns
 * `a + b` into string concatenation and crashes on `.toFixed`. Coerce the known
 * numeric keys back to real numbers at the data-access boundary so every caller
 * can trust the `number` type the schema promises.
 */
export function coerceNumeric<T, K extends keyof T>(
  row: T,
  keys: readonly K[],
): T {
  const out = { ...row };
  for (const key of keys) {
    const value = out[key];
    if (typeof value === "string" && value.trim() !== "") {
      out[key] = Number(value) as T[K];
    }
  }
  return out;
}

export function coerceNumericList<T, K extends keyof T>(
  rows: T[],
  keys: readonly K[],
): T[] {
  return rows.map((row) => coerceNumeric(row, keys));
}
