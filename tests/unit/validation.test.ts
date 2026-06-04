import { describe, expect, it } from "vitest";
import {
  hasValidCurrencyPrecision,
  isValidCurrencyAmount,
  isValidEmailAddress,
  normalizeCurrencyAmount,
  normalizeEmail,
} from "@/lib/validation";

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

describe("currency validation", () => {
  it("accepts whole pounds and pence values", () => {
    expect(hasValidCurrencyPrecision("43")).toBe(true);
    expect(hasValidCurrencyPrecision("43.37")).toBe(true);
  });

  it("rejects more than two decimal places", () => {
    expect(hasValidCurrencyPrecision("43.371")).toBe(false);
  });

  it("validates amount ranges", () => {
    expect(isValidCurrencyAmount("5.50", { min: 5, max: 50000 })).toBe(true);
    expect(isValidCurrencyAmount("4.99", { min: 5, max: 50000 })).toBe(false);
    expect(isValidCurrencyAmount("50000.01", { min: 5, max: 50000 })).toBe(
      false,
    );
  });

  it("normalizes currency values to two decimal precision", () => {
    expect(normalizeCurrencyAmount(43.379)).toBe(43.38);
  });
});
