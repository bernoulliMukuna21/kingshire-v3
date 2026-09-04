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
};

/**
 * Our receiving bank details for the manual route, from env. Returns null when
 * unconfigured so the UI can fall back to "contact us for payment details".
 */
export function getManualBankDetails(): ManualBankDetails | null {
  const accountName = process.env.KINGSHIRE_BANK_ACCOUNT_NAME;
  const sortCode = process.env.KINGSHIRE_BANK_SORT_CODE;
  const accountNumber = process.env.KINGSHIRE_BANK_ACCOUNT_NUMBER;
  if (!accountName || !sortCode || !accountNumber) return null;
  return { accountName, sortCode, accountNumber };
}

/** Client-facing note explaining the bank-transfer fee (no card fee, no 30p). */
export function manualFeeNote() {
  const pct = Math.round(PLATFORM_FEE_RATE_CLIENT * 100);
  return `Pay by bank transfer and you only pay our ${pct}% service fee — no card fee.`;
}
