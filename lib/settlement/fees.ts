import { calculateFees, MIN_JOB_BUDGET_GBP } from "@/lib/stripe";
import type { SettlementMode } from "./types";

// Smallest per-period worker pay we'll process. Keeps each Stripe charge worth
// running against its fixed per-charge cost. Reuses the one-off job floor.
export const MIN_PERIOD_AMOUNT_GBP = MIN_JOB_BUDGET_GBP;

export function meetsMinimumPeriodAmount(amountPerPeriod: number): boolean {
  return amountPerPeriod >= MIN_PERIOD_AMOUNT_GBP;
}

export type PeriodFees = {
  /** Pay to the worker this period. 0 in direct mode (paid off-platform). */
  workerAmount: number;
  platformFeeClient: number;
  platformFeeKinglancer: number;
  /** What the org's card is charged this period. */
  orgChargeGBP: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Per-period money split.
 * - managed: charge the org (pay + client fee); the worker later receives
 *   (pay − kinglancer fee) from escrow.
 * - direct: the worker is paid off-platform, so charge only the facilitation
 *   fee (client + kinglancer fee on the declared amount).
 */
export function periodFees(args: {
  amountPerPeriod: number;
  mode: SettlementMode;
}): PeriodFees {
  const { platformFeeClient, platformFeeKinglancer } = calculateFees(
    args.amountPerPeriod,
    { includeFixed: false },
  );
  if (args.mode === "managed") {
    return {
      workerAmount: round2(args.amountPerPeriod),
      platformFeeClient,
      platformFeeKinglancer,
      orgChargeGBP: round2(args.amountPerPeriod + platformFeeClient),
    };
  }
  return {
    workerAmount: 0,
    platformFeeClient,
    platformFeeKinglancer,
    orgChargeGBP: round2(platformFeeClient + platformFeeKinglancer),
  };
}
