/** Returns 1-2 uppercase initials from a full name, or "?" if absent. */
export function getInitials(fullName: string | null | undefined): string {
  return (
    fullName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "?"
  );
}

export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

// ── Money / rate formatting ───────────────────────────────

// Formatters are defined once and reused — `new Intl.NumberFormat` is
// expensive to construct; avoid creating an instance on every call.
const GBP_INTEGER = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});
const GBP_DECIMAL = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format a GBP amount. Whole numbers are displayed without decimals (£345),
 * fractional amounts with two decimal places (£12.50).
 */
export function formatMoney(value: number): string {
  return (value % 1 === 0 ? GBP_INTEGER : GBP_DECIMAL).format(value);
}

/**
 * Human label for a job rate type.
 * Returns "/hr", "/day", or "fixed" (empty string suffix for display).
 */
export function formatRateType(rateType: string | null | undefined): string {
  if (rateType === "per_hour") return "/hr";
  if (rateType === "per_day") return "/day";
  return "fixed";
}

