import { describe, it, expect } from "vitest";
import {
  deriveAgreementView,
  agreementStatusPill,
  placementPaymentPill,
} from "@/lib/placement-agreements";

const base = {
  status: "active",
  payment_mode: "managed",
  monthly_amount: 500,
  end_requested_by: null as string | null,
};

describe("deriveAgreementView", () => {
  it("an active managed agreement can be completed, ended and checked into", () => {
    const v = deriveAgreementView(base);
    expect(v.isActive).toBe(true);
    expect(v.isManaged).toBe(true);
    expect(v.canComplete).toBe(true);
    expect(v.canEndEarly).toBe(true);
    expect(v.canCheckIn).toBe(true);
    expect(v.pill.label).toBe("Active");
  });

  it("cannot be completed while an early-end request is pending", () => {
    const v = deriveAgreementView({ ...base, end_requested_by: "user-1" });
    expect(v.canComplete).toBe(false);
    expect(v.canEndEarly).toBe(true);
  });

  it("a pending offer can't be completed, ended or checked into", () => {
    const v = deriveAgreementView({ ...base, status: "pending_acceptance" });
    expect(v.isPending).toBe(true);
    expect(v.canComplete).toBe(false);
    expect(v.canEndEarly).toBe(false);
    expect(v.canCheckIn).toBe(false);
    expect(v.pill.label).toBe("Awaiting acceptance");
  });

  it("a completed agreement offers no further actions", () => {
    const v = deriveAgreementView({ ...base, status: "completed" });
    expect(v.canComplete).toBe(false);
    expect(v.canEndEarly).toBe(false);
    expect(v.pill.label).toBe("Completed");
  });

  it("treats a direct (non-money) agreement as not managed", () => {
    const v = deriveAgreementView({
      ...base,
      payment_mode: "direct",
      monthly_amount: null,
    });
    expect(v.isManaged).toBe(false);
  });
});

describe("status pills", () => {
  it("labels a cancelled agreement as ended early", () => {
    expect(agreementStatusPill("cancelled").label).toBe("Ended early");
  });

  it("labels payment statuses", () => {
    expect(placementPaymentPill("held").label).toBe("In escrow");
    expect(placementPaymentPill("released").label).toBe("Paid");
  });

  it("falls back gracefully for unknown statuses", () => {
    expect(agreementStatusPill("weird").label).toBe("weird");
    expect(placementPaymentPill("weird").label).toBe("weird");
  });
});
