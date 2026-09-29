import { randomBytes, timingSafeEqual } from "node:crypto";

export const KINGSCHAT_STATE_COOKIE = "__Host-kingschat-state";
export const KINGSCHAT_STATE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "none" as const,
  path: "/",
  maxAge: 600,
};

export function createKingsChatState(next: string, now = Date.now()): string {
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
      ? next
      : "/";
  return Buffer.from(
    JSON.stringify({
      nonce: randomBytes(32).toString("hex"),
      next: safeNext,
      issued: now,
    }),
  ).toString("base64url");
}

/** The provider echoes origin. Bind that opaque value to the initiating browser. */
export function verifyKingsChatState(
  origin: string | undefined,
  cookie: string | undefined,
  now = Date.now(),
): string | null {
  if (!origin || !cookie || origin.length > 4096) return null;
  const supplied = Buffer.from(origin);
  const expected = Buffer.from(cookie);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return null;
  try {
    const payload = JSON.parse(
      Buffer.from(origin, "base64url").toString("utf8"),
    );
    if (
      typeof payload.issued !== "number" ||
      now < payload.issued ||
      now - payload.issued > 600_000 ||
      typeof payload.nonce !== "string" ||
      !/^[a-f0-9]{64}$/.test(payload.nonce) ||
      typeof payload.next !== "string" ||
      !payload.next.startsWith("/") ||
      payload.next.startsWith("//") ||
      payload.next.includes("\\")
    )
      return null;
    return payload.next;
  } catch {
    return null;
  }
}
