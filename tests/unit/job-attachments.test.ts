import { describe, expect, it } from "vitest";
import { canAttachJobFile, jobAttachmentError, JOB_ATTACHMENT_MAX_BYTES, parseJobAttachment } from "@/lib/job-attachments";

describe("job attachments", () => {
  it.each(["active", "trialing"])("allows subscribed organisations: %s", (status) => {
    expect(canAttachJobFile(status)).toBe(true);
  });
  it.each([null, undefined, "past_due", "canceled", "unpaid", "paused", "incomplete", "incomplete_expired"])("denies missing/ineligible subscriptions: %s", (status) => {
    expect(canAttachJobFile(status)).toBe(false);
  });
  it.each(["brief.pdf", "Brief.PDF", "brief.doc", "brief.docx", "brief.txt"])("accepts supported documents: %s", (name) => {
    expect(jobAttachmentError({ name, size: JOB_ATTACHMENT_MAX_BYTES })).toBeNull();
  });
  it.each(["brief.exe", "brief.html", "brief.svg", "brief.pdf.exe", "brief.constructor", "brief.__proto__", "../brief.pdf", "brief\n.pdf"])("rejects unsupported or unsafe names: %s", (name) => {
    expect(jobAttachmentError({ name, size: 10 })).not.toBeNull();
  });
  it.each([0, -1, NaN, Infinity, JOB_ATTACHMENT_MAX_BYTES + 1])("rejects invalid file sizes: %s", (size) => {
    expect(jobAttachmentError({ name: "brief.pdf", size })).not.toBeNull();
  });
  it("narrows valid metadata and rejects malformed stored data", () => {
    const file = { path: "org/job/file", name: "brief.pdf", size: 1024, contentType: "application/pdf" };
    expect(parseJobAttachment(file)).toEqual(file);
    for (const value of [null, "https://example.com", [], {}, { ...file, size: "1024" }, { ...file, contentType: "text/html" }]) {
      expect(parseJobAttachment(value)).toBeNull();
    }
  });
});
