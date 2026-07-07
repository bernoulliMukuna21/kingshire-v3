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

/**
 * Format a job deadline date string for display.
 * Returns "Today", "Tomorrow", or a short date ("7 Jul 2026").
 * Returns null if no deadline is set.
 */
export function formatDeadline(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  const deadline = new Date(value);
  deadline.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (deadline.getTime() === today.getTime()) return "Today";
  if (deadline.getTime() === tomorrow.getTime()) return "Tomorrow";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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
