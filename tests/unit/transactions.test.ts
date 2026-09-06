import { describe, it, expect } from "vitest";
import { transactionStatusPill } from "@/lib/transactions";

describe("transactionStatusPill", () => {
  it("maps job escrow statuses to a single canonical label", () => {
    expect(transactionStatusPill("held").label).toBe("In escrow");
    expect(transactionStatusPill("released").label).toBe("Released");
    expect(transactionStatusPill("pending").label).toBe("Awaiting payment");
    expect(transactionStatusPill("refunded").label).toBe("Refunded");
    expect(transactionStatusPill("disputed").label).toBe("Disputed");
  });

  it("falls back to the raw status for unknowns", () => {
    expect(transactionStatusPill("weird").label).toBe("weird");
  });
});
