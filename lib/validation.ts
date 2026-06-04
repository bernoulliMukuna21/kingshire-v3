export const EMAIL_VALIDATION_MESSAGE = "Please enter a valid email address.";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmailAddress(email: string) {
  const normalizedEmail = normalizeEmail(email);

  if (normalizedEmail.length > 254) return false;
  if (normalizedEmail.includes("..")) return false;

  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizedEmail);
}
