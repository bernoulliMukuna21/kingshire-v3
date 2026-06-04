export const EMAIL_VALIDATION_MESSAGE = "Please enter a valid email address.";
export const CURRENCY_VALIDATION_MESSAGE =
  "Please enter a valid amount with up to 2 decimal places.";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmailAddress(email: string) {
  const normalizedEmail = normalizeEmail(email);

  if (normalizedEmail.length > 254) return false;
  if (normalizedEmail.includes("..")) return false;

  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizedEmail);
}

export function hasValidCurrencyPrecision(value: string | number) {
  const rawValue = String(value).trim();

  if (!rawValue) return false;
  if (!/^\d+(\.\d{0,2})?$/.test(rawValue)) return false;

  return Number.isFinite(Number(rawValue));
}

export function normalizeCurrencyAmount(value: string | number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function isValidCurrencyAmount(
  value: string | number,
  options: { min?: number; max?: number } = {},
) {
  if (!hasValidCurrencyPrecision(value)) return false;

  const amount = Number(value);
  if (options.min !== undefined && amount < options.min) return false;
  if (options.max !== undefined && amount > options.max) return false;

  return true;
}
