import { describe, it, expect } from "vitest";
import { calculateFees, PLATFORM_FEE_RATE } from "@/lib/stripe";

describe("PLATFORM_FEE_RATE", () => {
  it("is 5%", () => {
    expect(PLATFORM_FEE_RATE).toBe(0.05);
  });
});

describe("calculateFees", () => {
  it("charges client budget + 5% on top", () => {
    const { platformFeeClient, clientChargeGBP } = calculateFees(100);
    expect(platformFeeClient).toBe(5);
    expect(clientChargeGBP).toBe(105);
  });

  it("deducts 5% from kinglancer side", () => {
    const { platformFeeKinglancer } = calculateFees(100);
    expect(platformFeeKinglancer).toBe(5);
  });

  it("converts GBP to pence correctly", () => {
    const { clientChargePence } = calculateFees(100);
    expect(clientChargePence).toBe(10500);
  });

  it("handles non-round budgets", () => {
    const { platformFeeClient, clientChargeGBP } = calculateFees(250);
    expect(platformFeeClient).toBe(12.5);
    expect(clientChargeGBP).toBe(262.5);
    expect(calculateFees(250).clientChargePence).toBe(26250);
  });

  it("rounds fee to 2 decimal places", () => {
    // £33.33 × 5% = £1.6665 → rounded to £1.67
    const { platformFeeClient } = calculateFees(33.33);
    expect(platformFeeClient).toBe(1.67);
  });

  it("handles zero budget", () => {
    const result = calculateFees(0);
    expect(result.platformFeeClient).toBe(0);
    expect(result.platformFeeKinglancer).toBe(0);
    expect(result.clientChargeGBP).toBe(0);
    expect(result.clientChargePence).toBe(0);
  });

  it("client fee and kinglancer fee are always equal", () => {
    [10, 99.99, 1500, 0.5].forEach((budget) => {
      const { platformFeeClient, platformFeeKinglancer } =
        calculateFees(budget);
      expect(platformFeeClient).toBe(platformFeeKinglancer);
    });
  });

  it("pence value matches GBP × 100 (rounded)", () => {
    [50, 75.5, 1000].forEach((budget) => {
      const { clientChargeGBP, clientChargePence } = calculateFees(budget);
      expect(clientChargePence).toBe(Math.round(clientChargeGBP * 100));
    });
  });
});
