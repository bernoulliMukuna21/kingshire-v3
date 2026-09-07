import { describe, it, expect } from "vitest";
import { computeEspees } from "@/lib/espees-fx";

describe("computeEspees", () => {
  it("returns the GBP amount unchanged when GBP=USD=ESP peg and no buffer", () => {
    expect(
      computeEspees({ gbp: 16, usdPerGbp: 1.6, usdPerEsp: 1.6, buffer: 0 }),
    ).toBe(16);
  });

  it("applies the ESP peg (1 ESP = $1.60)", () => {
    // £10 × $1.60/£ ÷ $1.60/ESP = 10 ESP
    expect(
      computeEspees({ gbp: 10, usdPerGbp: 1.6, usdPerEsp: 1.6, buffer: 0 }),
    ).toBe(10);
  });

  it("adds the FX buffer", () => {
    // 16 ESP × 1.02 = 16.32
    expect(
      computeEspees({ gbp: 16, usdPerGbp: 1.6, usdPerEsp: 1.6, buffer: 0.02 }),
    ).toBe(16.32);
  });

  it("converts through USD and rounds to 2dp", () => {
    // £20 × $1.30/£ ÷ $1.60/ESP = 16.25 ESP
    expect(
      computeEspees({ gbp: 20, usdPerGbp: 1.3, usdPerEsp: 1.6, buffer: 0 }),
    ).toBe(16.25);
  });
});
