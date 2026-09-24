import type { Cadence } from "./types";

// All arithmetic is done in UTC because a period's `due_date` is a calendar date
// (no time zone) and the app runs in UTC — keeps scheduling deterministic.

/** Advance a date by `n` cadence steps (a week or a calendar month). */
export function addPeriods(date: Date, n: number, cadence: Cadence): Date {
  const d = new Date(date);
  if (cadence === "weekly") d.setUTCDate(d.getUTCDate() + 7 * n);
  else d.setUTCMonth(d.getUTCMonth() + n);
  return d;
}

/** Period 1 is due at the anchor; period `i` is due `i-1` cadence steps later. */
export function periodDueDate(
  anchor: Date,
  cadence: Cadence,
  periodIndex: number,
): Date {
  return addPeriods(anchor, periodIndex - 1, cadence);
}

/** The period a payment covers ends one cadence step after it falls due. */
export function periodEnd(dueDate: Date, cadence: Cadence): Date {
  return addPeriods(dueDate, 1, cadence);
}

/** Days before period-end we warn the org that the payout will release.
 *  Shorter for weekly so the notice fits inside the period. */
export function releaseNoticeDays(cadence: Cadence): number {
  return cadence === "weekly" ? 2 : 7;
}

/**
 * The period indexes to create for a schedule. A bounded engagement
 * (`durationPeriods` set) yields every period from `fromIndex`; an open-ended
 * one (`durationPeriods` null) yields a rolling window of `rollingCount` (the
 * charge step tops this up so the next period always exists).
 */
export function plannedPeriodIndexes(args: {
  durationPeriods: number | null;
  fromIndex?: number;
  rollingCount?: number;
}): number[] {
  const from = args.fromIndex ?? 1;
  if (args.durationPeriods == null) {
    const count = args.rollingCount ?? 1;
    return Array.from({ length: count }, (_, i) => from + i);
  }
  const out: number[] = [];
  for (let i = from; i <= args.durationPeriods; i++) out.push(i);
  return out;
}
