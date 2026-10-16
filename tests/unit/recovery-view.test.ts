import { describe, expect, it } from "vitest";
import {
  deriveRecoveryView,
  type RecoveryState,
} from "@/lib/settlement/recovery-view";

const base: RecoveryState = {
  release_attempt_id: "attempt",
  release_outcome: null,
  release_dispatch_started_at: null,
  release_failure_code: null,
  release_idempotency_key: null,
  stripe_transfer_id: null,
  stripe_refund_id: null,
};

describe("payment help for operators", () => {
  it("keeps unknown outcomes uncertain rather than claiming money was not sent", () => {
    const view = deriveRecoveryView(base);
    expect(view.explanation).toContain("may already have been sent");
    expect(view.nextStep).toContain("before trying again");
    expect(view.canReset).toBe(false);
  });
  it("explains a confirmed insufficient balance without claiming it was paid", () => {
    const view = deriveRecoveryView({
      ...base,
      release_outcome: "failed",
      release_failure_code: "balance_insufficient",
    });
    expect(view.label).toBe("Not enough money in Stripe");
    expect(view.explanation).toContain("did not send");
    expect(view.canReset).toBe(true);
  });
  it("prioritises an existing Stripe result over a stale failure", () => {
    for (const reference of [
      { stripe_transfer_id: "tr_existing" },
      { stripe_refund_id: "re_existing" },
    ]) {
      const view = deriveRecoveryView({
        ...base,
        ...reference,
        release_outcome: "failed",
        release_failure_code: "balance_insufficient",
      });
      expect(view.label).toBe("Payment result needs saving");
      expect(view.canReset).toBe(false);
    }
  });
  it("does not call a dispatched reservation unsent", () => {
    const view = deriveRecoveryView({
      ...base,
      release_outcome: "reserved",
      release_dispatch_started_at: new Date().toISOString(),
    });
    expect(view.explanation).toContain("may already have been sent");
    expect(view.canReset).toBe(false);
  });
  it("explains a reservation that has never been dispatched", () => {
    const view = deriveRecoveryView({ ...base, release_outcome: "reserved" });
    expect(view.label).toBe("Payment has not been sent");
    expect(view.canReset).toBe(true);
  });
});
