import { PLATFORM_FEE_RATE_CLIENT } from "@/lib/stripe";

/**
 * Manual (off-Stripe) settlement helpers. A client may pay by bank transfer
 * directly to us; we hold the funds and pay the worker out by hand. See
 * migration 053 and the admin settlement routes.
 */

export type ManualBankDetails = {
  accountName: string;
  sortCode: string;
  accountNumber: string;
  // True when these are stand-in test details, not a real receiving account.
  isPlaceholder?: boolean;
};

/**
 * Our receiving bank details for the manual route, from env. When unconfigured,
 * returns clearly-marked dummy details only if MANUAL_BANK_DUMMY is set (for
 * staging demos) — otherwise null so the UI shows "contact us for details" and
 * we never surface a fake account in production by accident.
 */
export function getManualBankDetails(): ManualBankDetails | null {
  const accountName = process.env.KINGSHIRE_BANK_ACCOUNT_NAME;
  const sortCode = process.env.KINGSHIRE_BANK_SORT_CODE;
  const accountNumber = process.env.KINGSHIRE_BANK_ACCOUNT_NUMBER;
  if (accountName && sortCode && accountNumber) {
    return { accountName, sortCode, accountNumber };
  }
  if (process.env.MANUAL_BANK_DUMMY) {
    return {
      accountName: "KingsHire Ltd (TEST — not a real account)",
      sortCode: "04-00-04",
      accountNumber: "00000000",
      isPlaceholder: true,
    };
  }
  return null;
}

/** Client-facing note explaining the bank-transfer fee (no card fee, no 30p). */
export function manualFeeNote() {
  const pct = Math.round(PLATFORM_FEE_RATE_CLIENT * 100);
  return `Pay by bank transfer and you only pay our ${pct}% service fee — no card fee.`;
}
