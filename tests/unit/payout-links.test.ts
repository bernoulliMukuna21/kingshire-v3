import { describe, it, expect } from "vitest";
import {
  isPayoutProvider,
  payoutProviderLabel,
  validatePayoutLink,
} from "@/lib/payout-links";

describe("payout-links", () => {
  it("recognises valid providers", () => {
    expect(isPayoutProvider("revolut")).toBe(true);
    expect(isPayoutProvider("paypal")).toBe(true);
    expect(isPayoutProvider("bitcoin")).toBe(false);
  });

  it("labels providers", () => {
    expect(payoutProviderLabel("monzo")).toBe("Monzo");
    expect(payoutProviderLabel("unknown")).toBe("unknown");
  });

  it("accepts a matching provider link", () => {
    const r = validatePayoutLink("revolut", "https://revolut.me/bernoulli");
    expect(r).toEqual({ ok: true, link: "https://revolut.me/bernoulli" });
  });

  it("normalises www and accepts it", () => {
    const r = validatePayoutLink("paypal", "https://www.paypal.me/bernoulli");
    expect(r.ok).toBe(true);
  });

  it("rejects a host that doesn't match the provider", () => {
    const r = validatePayoutLink("revolut", "https://paypal.me/bernoulli");
    expect(r.ok).toBe(false);
  });

  it("rejects non-https", () => {
    const r = validatePayoutLink("monzo", "http://monzo.me/bernoulli");
    expect(r.ok).toBe(false);
  });

  it("rejects a non-url", () => {
    const r = validatePayoutLink("wise", "not a link");
    expect(r.ok).toBe(false);
  });

  it("allows any https host for 'other'", () => {
    const r = validatePayoutLink("other", "https://example.com/pay/me");
    expect(r.ok).toBe(true);
  });

  it("rejects an unknown provider", () => {
    const r = validatePayoutLink("bitcoin", "https://revolut.me/x");
    expect(r.ok).toBe(false);
  });
});
