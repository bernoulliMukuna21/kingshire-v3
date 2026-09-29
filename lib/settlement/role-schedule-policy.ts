import { meetsMinimumPeriodCharge } from "./fees";
import { roleBillingFractions } from "./schedule";
import type { Cadence, SettlementMode } from "./types";

/** Every bounded-role instalment must be large enough for the selected rail.
 * The advertised full-period amount can pass validation while a short first
 * or final period prorates below the collection floor. */
export function roleScheduleMeetsMinimumCharge(args: {
  anchor: Date;
  boundEnd: Date;
  cadence: Cadence;
  amountPerPeriod: number;
  settlementMode: SettlementMode;
}): boolean {
  const fractions = roleBillingFractions(args.anchor, args.boundEnd, args.cadence);
  return (
    fractions.length > 0 &&
    fractions.every((fraction) =>
      meetsMinimumPeriodCharge(
        Math.round(args.amountPerPeriod * fraction * 100) / 100,
        args.settlementMode,
      ),
    )
  );
}
