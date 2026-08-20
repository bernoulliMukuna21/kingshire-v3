import { describe, it, expect } from "vitest";
import {
  calculateFees,
  PLATFORM_FEE_RATE_CLIENT,
  PLATFORM_FEE_RATE_KINGLANCER,
  PLATFORM_FEE_FIXED_CLIENT,
  MIN_JOB_BUDGET_GBP,
} from "@/lib/stripe";

describe("platform fee rates", () => {
  it("client rate is 5%", () => {
    expect(PLATFORM_FEE_RATE_CLIENT).toBe(0.05);
  });
  it("kinglancer rate is 7.5%", () => {
    expect(PLATFORM_FEE_RATE_KINGLANCER).toBe(0.075);
  });
  it("client fixed component is 30p", () => {
    expect(PLATFORM_FEE_FIXED_CLIENT).toBe(0.3);
  });
  it("minimum job budget is £20", () => {
    expect(MIN_JOB_BUDGET_GBP).toBe(20);
  });
});

describe("calculateFees", () => {
  it("charges client budget + 5% + 30p on top", () => {
    const { platformFeeClient, clientChargeGBP } = calculateFees(100);
    expect(platformFeeClient).toBe(5.3);
    expect(clientChargeGBP).toBe(105.3);
  });

  it("deducts 7.5% from kinglancer side", () => {
    const { platformFeeKinglancer } = calculateFees(100);
    expect(platformFeeKinglancer).toBe(7.5);
  });

  it("converts GBP to pence correctly", () => {
    const { clientChargePence } = calculateFees(100);
    expect(clientChargePence).toBe(10530);
  });

  it("matches the £20 minimum-job example", () => {
    const { clientChargeGBP, platformFeeKinglancer } = calculateFees(20);
    // Client pays £21.30, Kinglancer keeps £18.50.
    expect(clientChargeGBP).toBe(21.3);
    expect(20 - platformFeeKinglancer).toBe(18.5);
  });

  it("handles non-round budgets", () => {
    const { platformFeeClient, clientChargeGBP } = calculateFees(250);
    expect(platformFeeClient).toBe(12.8);
    expect(clientChargeGBP).toBe(262.8);
    expect(calculateFees(250).clientChargePence).toBe(26280);
  });

  it("rounds fee to 2 decimal places", () => {
    // £33.33 × 5% = £1.6665 + £0.30 = £1.9665 → rounded to £1.97
    const { platformFeeClient } = calculateFees(33.33);
    expect(platformFeeClient).toBe(1.97);
  });

  it("handles zero budget (fixed fee still applies)", () => {
    const result = calculateFees(0);
    expect(result.platformFeeClient).toBe(0.3);
    expect(result.platformFeeKinglancer).toBe(0);
    expect(result.clientChargeGBP).toBe(0.3);
    expect(result.clientChargePence).toBe(30);
  });

  it("each side matches its own rate", () => {
    [10, 99.99, 1500, 0.5].forEach((budget) => {
      const { platformFeeClient, platformFeeKinglancer } =
        calculateFees(budget);
      expect(platformFeeClient).toBe(
        Math.round(
          (budget * PLATFORM_FEE_RATE_CLIENT + PLATFORM_FEE_FIXED_CLIENT) * 100,
        ) / 100,
      );
      expect(platformFeeKinglancer).toBe(
        Math.round(budget * PLATFORM_FEE_RATE_KINGLANCER * 100) / 100,
      );
    });
  });

  it("pence value matches GBP × 100 (rounded)", () => {
    [50, 75.5, 1000].forEach((budget) => {
      const { clientChargeGBP, clientChargePence } = calculateFees(budget);
      expect(clientChargePence).toBe(Math.round(clientChargeGBP * 100));
    });
  });
});
