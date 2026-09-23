export const JOB_ATTACHMENT_MAX_BYTES = 3 * 1024 * 1024;
export const JOB_ATTACHMENT_BUCKET = "job-attachments";
export const JOB_ATTACHMENT_ACCEPT = ".pdf,.doc,.docx,.txt";

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

export type JobAttachment = {
  path: string;
  name: string;
  size: number;
  contentType: string;
};

export function canAttachJobFile(subscriptionStatus: string | null | undefined) {
  return subscriptionStatus === "active" || subscriptionStatus === "trialing";
}

export function jobAttachmentError(file: { name: string; size: number }): string | null {
  if (!Object.hasOwn(CONTENT_TYPES, file.name.split(".").pop()?.toLowerCase() ?? ""))
    return "Choose a PDF, Word document (.doc or .docx), or text file.";
  if (!Number.isSafeInteger(file.size) || file.size <= 0) return "The attachment is empty. Choose another file.";
  if (file.size > JOB_ATTACHMENT_MAX_BYTES) return "The attachment must be 3 MB or smaller.";
  if (file.name.length > 200 || /[\x00-\x1f\x7f/\\]/.test(file.name))
    return "Choose a file with a shorter name and no special path characters.";
  return null;
}

export function jobAttachmentContentType(name: string): string {
  return CONTENT_TYPES[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

/** Narrow stored JSON once; never render an arbitrary URL from attachment data. */
export function parseJobAttachment(value: unknown): JobAttachment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.path !== "string" || typeof v.name !== "string" ||
      typeof v.size !== "number" || typeof v.contentType !== "string" ||
      jobAttachmentError({ name: v.name, size: v.size }) ||
      v.contentType !== jobAttachmentContentType(v.name)) return null;
  return { path: v.path, name: v.name, size: v.size, contentType: v.contentType };
}
