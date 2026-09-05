import { describe, it, expect } from "vitest";
import {
  calculateFees,
  PLATFORM_FEE_RATE_CLIENT,
  PLATFORM_FEE_RATE_KINGLANCER,
  PLATFORM_FEE_FIXED_CLIENT,
  MIN_JOB_BUDGET_GBP,
} from "@/lib/stripe";

describe("platform fee rates", () => {
  it("client rate is 2.5%", () => {
    expect(PLATFORM_FEE_RATE_CLIENT).toBe(0.025);
  });
  it("kinglancer rate is 5%", () => {
    expect(PLATFORM_FEE_RATE_KINGLANCER).toBe(0.05);
  });
  it("client fixed component is 0 (covered by the subscription)", () => {
    expect(PLATFORM_FEE_FIXED_CLIENT).toBe(0);
  });
  it("minimum job budget is £20", () => {
    expect(MIN_JOB_BUDGET_GBP).toBe(20);
  });
});

describe("calculateFees", () => {
  it("charges client budget + 2.5% on top", () => {
    const { platformFeeClient, clientChargeGBP } = calculateFees(100);
    expect(platformFeeClient).toBe(2.5);
    expect(clientChargeGBP).toBe(102.5);
  });

  it("deducts 5% from kinglancer side", () => {
    const { platformFeeKinglancer } = calculateFees(100);
    expect(platformFeeKinglancer).toBe(5);
  });

  it("converts GBP to pence correctly", () => {
    const { clientChargePence } = calculateFees(100);
    expect(clientChargePence).toBe(10250);
  });

  it("handles non-round budgets", () => {
    const { platformFeeClient, clientChargeGBP } = calculateFees(250);
    expect(platformFeeClient).toBe(6.25);
    expect(clientChargeGBP).toBe(256.25);
    expect(calculateFees(250).clientChargePence).toBe(25625);
  });

  it("rounds fee to 2 decimal places", () => {
    // £33.33 × 2.5% = £0.83325 → rounded to £0.83
    const { platformFeeClient } = calculateFees(33.33);
    expect(platformFeeClient).toBe(0.83);
  });

  it("handles zero budget", () => {
    const result = calculateFees(0);
    expect(result.platformFeeClient).toBe(0);
    expect(result.platformFeeKinglancer).toBe(0);
    expect(result.clientChargeGBP).toBe(0);
    expect(result.clientChargePence).toBe(0);
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

// A worked example for a £20 minimum job under the current model: client 2.5%,
// kinglancer 5%, no fixed fee. Stripe's own card costs are covered by the
// subscriptions (card is a subscriber-only rail below the threshold).
describe("£20 job simulation", () => {
  const budget = 20;
  const fees = calculateFees(budget);
  const clientPays = fees.clientChargeGBP;
  const kinglancerReceives = budget - fees.platformFeeKinglancer;
  const platformGrossTake = fees.platformFeeClient + fees.platformFeeKinglancer;

  it("client pays £20.50 (budget + 2.5%)", () => {
    expect(clientPays).toBe(20.5);
    expect(fees.clientChargePence).toBe(2050);
  });

  it("kinglancer receives £19.00 (budget − 5%)", () => {
    expect(kinglancerReceives).toBe(19);
  });

  it("platform gross take is £1.50 (client £0.50 + kinglancer £1.00)", () => {
    expect(fees.platformFeeClient).toBe(0.5);
    expect(fees.platformFeeKinglancer).toBe(1);
    expect(platformGrossTake).toBe(1.5);
  });
});
