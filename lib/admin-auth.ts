import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE = "kh_admin_session";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 12;

type AdminSessionPayload = {
  sub: string;
  iat: number;
};

export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

export function isAdminPasscodeConfigured() {
  return Boolean(process.env.ADMIN_PASSCODE);
}

function getAdminSessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.ADMIN_PASSCODE
  );
}

function signPayload(payload: string) {
  const secret = getAdminSessionSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createAdminSessionValue(userId: string) {
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
    } satisfies AdminSessionPayload),
  ).toString("base64url");
  const signature = signPayload(payload);

  if (!signature) return null;
  return `${payload}.${signature}`;
}

export function verifyAdminSessionValue(
  value: string | undefined,
  userId: string,
) {
  if (!value) return false;

  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;

  const expectedSignature = signPayload(payload);
  if (!expectedSignature || !safeEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<AdminSessionPayload>;

    if (session.sub !== userId || typeof session.iat !== "number") {
      return false;
    }

    const age = Math.floor(Date.now() / 1000) - session.iat;
    return age >= 0 && age <= ADMIN_SESSION_MAX_AGE;
  } catch {
    return false;
  }
}

export async function hasValidAdminSession(userId: string) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_SESSION_COOKIE);
  return verifyAdminSessionValue(sessionCookie?.value, userId);
}
