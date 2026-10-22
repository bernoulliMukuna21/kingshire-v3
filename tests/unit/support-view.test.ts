import { describe, expect, it } from "vitest";
import {
  contactHref,
  contactSource,
  deriveEnquiryView,
  enquirySchema,
} from "@/lib/support/view";
const input = {
  id: "ad463989-195f-4f9b-9be4-765446da66af",
  topic: "account",
  name: "Ada",
  email: " Ada@Example.COM ",
  organisation: "",
  reference: "",
  message: "I need help finding my job.",
  sourcePath: "/dashboard/client?token=private#details",
  website: "",
};
describe("customer enquiries", () => {
  it("requires a reply address and name for help and demos", () => {
    for (const topic of ["account", "payment", "demo"]) {
      expect(
        enquirySchema.safeParse({ ...input, topic, email: "" }).success,
      ).toBe(false);
      expect(
        enquirySchema.safeParse({ ...input, topic, name: " " }).success,
      ).toBe(false);
    }
  });
  it("accepts feedback without identity or email", () => {
    expect(
      enquirySchema.safeParse({
        ...input,
        topic: "feedback",
        name: "",
        email: "",
      }).success,
    ).toBe(true);
  });
  it("validates an optional feedback email when supplied", () => {
    expect(
      enquirySchema.safeParse({
        ...input,
        topic: "feedback",
        email: "bad-address",
      }).success,
    ).toBe(false);
  });
  it("normalises email and removes query strings from page context", () => {
    const parsed = enquirySchema.parse(input);
    expect(parsed.email).toBe("ada@example.com");
    expect(parsed.sourcePath).toBe("/dashboard/client");
  });
  it("rejects external and protocol-relative page context", () => {
    for (const source of [
      "https://evil.test/",
      "//evil.test/",
      "/\\evil",
      "/hello\nworld",
    ])
      expect(contactSource(source)).toBe("");
  });
  it("creates a help link without sharing private query parameters", () => {
    const href = new URL(
      contactHref("payment", "/dashboard/client/jobs/123?secret=hidden"),
      "https://kingshire.uk",
    );
    expect(href.searchParams.get("from")).toBe("/dashboard/client/jobs/123");
    expect(href.searchParams.get("topic")).toBe("payment");
    expect(href.toString()).not.toContain("hidden");
  });
  it("sends feedback to Tally without forwarding identity or page context", () => {
    const href = contactHref(
      "feedback",
      "/dashboard/client/jobs/123?email=private@example.com",
    );
    expect(href).toBe("https://tally.so/r/GexYZL");
    expect(new URL(href).search).toBe("");
    expect(deriveEnquiryView("feedback").prompt).toBe(
      "How has your experience with KingsHire been?",
    );
  });
  it("does not promise a booked appointment or an email for anonymous feedback", () => {
    expect(deriveEnquiryView("demo").success).toContain("arrange a time");
    expect(deriveEnquiryView("feedback").success).not.toContain("email");
    expect(deriveEnquiryView("account", "in_progress").statusLabel).toBe(
      "In progress",
    );
  });
});
