import { createServiceClient } from "@/lib/supabase/service";

export type CvBucket = "job-application-cvs" | "placement-cvs";

// Long enough for a reviewer to open a page and click through; short enough
// that a leaked link is useless soon after.
const SIGNED_URL_TTL_SECONDS = 60 * 10;

/** Sign one stored CV path so a reviewer (not the file's owner) can view it
 * without the bucket being public. Returns null if there's nothing to sign
 * or signing fails (e.g. the object was deleted). */
export async function signCvUrl(
  bucket: CvBucket,
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const db = createServiceClient();
  const { data, error } = await db.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Batch-sign for list views — one Storage call for every path instead of one
 * call per row. */
export async function signCvUrls(
  bucket: CvBucket,
  paths: string[],
): Promise<Map<string, string>> {
  const uniquePaths = [...new Set(paths)];
  if (uniquePaths.length === 0) return new Map();
  const db = createServiceClient();
  const { data, error } = await db.storage
    .from(bucket)
    .createSignedUrls(uniquePaths, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return new Map();
  const signedByPath = new Map<string, string>();
  for (const item of data) {
    if (item.signedUrl && !item.error && item.path) {
      signedByPath.set(item.path, item.signedUrl);
    }
  }
  return signedByPath;
}

/** A submitted CV path must live in the submitter's own storage folder —
 * otherwise anyone could attach someone else's CV by guessing/reusing a path. */
export function isOwnCvPath(path: string, userId: string): boolean {
  return (
    path.startsWith(`${userId}/`) &&
    !path.includes("\\") &&
    !path.includes("%") &&
    !path.includes("?") &&
    !path.includes("#") &&
    path
      .split("/")
      .every((part) => part !== ".." && part !== "." && part.length > 0)
  );
}

/** Accept only this project's legacy public URL or an owner-scoped object path. */
export function resolveCvPath(
  bucket: CvBucket,
  value: string | null | undefined,
  userId: string,
): string | null {
  if (!value) return null;
  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/`;
  let path = value;
  if (path.startsWith(prefix)) {
    try {
      path = decodeURIComponent(path.slice(prefix.length));
    } catch {
      return null;
    }
  }
  return isOwnCvPath(path, userId) ? path : null;
}
