import { describe, expect, it } from "vitest";
import { isValidEmailAddress, normalizeEmail } from "@/lib/validation";

describe("normalizeEmail", () => {
  it("trims and lowercases email addresses", () => {
    expect(normalizeEmail("  Jane.Doe@Example.COM  ")).toBe(
      "jane.doe@example.com",
    );
  });
});

describe("isValidEmailAddress", () => {
  it("accepts normal email addresses", () => {
    expect(isValidEmailAddress("paulin@example.com")).toBe(true);
    expect(isValidEmailAddress("paulin@example.co.uk")).toBe(true);
  });

  it("rejects domains without a public suffix", () => {
    expect(isValidEmailAddress("paulin@fjkse")).toBe(false);
  });

  it("rejects malformed email addresses", () => {
    expect(isValidEmailAddress("paulin")).toBe(false);
    expect(isValidEmailAddress("paulin@")).toBe(false);
    expect(isValidEmailAddress("@example.com")).toBe(false);
    expect(isValidEmailAddress("paulin@example..com")).toBe(false);
  });
});
