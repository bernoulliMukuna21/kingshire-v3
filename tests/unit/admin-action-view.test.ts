import { describe, it, expect } from "vitest";
import {
  deriveAdminActions,
  selectAdminActions,
  deriveAdminPayoutView,
  type AdminTask,
} from "@/lib/admin/action-view";
import { adminSection, adminNavigation } from "@/lib/admin/navigation";
const task = (patch: Partial<AdminTask> = {}): AdminTask => ({
  id: "one",
  entityKey: "payment:1",
  category: "payments",
  kind: "action",
  priority: 2,
  title: "Pay worker",
  description: "",
  href: "/admin/finance",
  createdAt: "2026-10-10",
  ...patch,
});
describe("admin task projections", () => {
  it("deduplicates a payment's payout/dispute/recovery decisions by priority", () => {
    const result = deriveAdminActions([
      task(),
      task({ id: "dispute", category: "disputes", priority: 1 }),
      task({ id: "recovery", priority: 0 }),
    ]);
    expect(result.items.map((row) => row.id)).toEqual(["recovery"]);
    expect(result.actionCount).toBe(1);
  });
  it("keeps waiting items out of the action badge and uses the rendered list for totals", () => {
    const result = deriveAdminActions([
      task(),
      task({ id: "wait", entityKey: "job:2", kind: "waiting", priority: 7 }),
    ]);
    expect(result.actionCount).toBe(selectAdminActions(result.items).length);
    expect(result.waitingCount).toBe(1);
    expect(
      selectAdminActions(result.items, "payments", "waiting").map(
        (row) => row.id,
      ),
    ).toEqual(["wait"]);
  });
  it("has stable chronological ordering and does not collapse separate source types", () => {
    const result = deriveAdminActions([
      task({ id: "role", entityKey: "period:1", createdAt: "2026-10-11" }),
      task({ id: "job", entityKey: "transaction:1" }),
    ]);
    expect(result.items.map((row) => row.id)).toEqual(["job", "role"]);
  });
});
const payment = {
  status: "held",
  payment_method: "card",
  payout_method: "manual",
  stripe_transfer_id: null,
  manual_payout_reference: null,
  stripe_refund_id: null,
  release_attempt_id: null,
};
describe("admin payout eligibility", () => {
  it("distinguishes card funding from manual payout", () =>
    expect(deriveAdminPayoutView(payment, "approved")).toEqual({
      eligible: true,
      manual: true,
    }));
  it.each([
    { stripe_transfer_id: "tr_paid" },
    { manual_payout_reference: "paid" },
    { stripe_refund_id: "re_refund" },
    { release_attempt_id: "attempt" },
    { status: "refunded" },
  ])("excludes settled and reserved payments %j", (patch) =>
    expect(
      deriveAdminPayoutView({ ...payment, ...patch }, "approved").eligible,
    ).toBe(false),
  );
  it("completed work awaiting client approval is not an admin payout", () =>
    expect(deriveAdminPayoutView(payment, "completed").eligible).toBe(false));
});
describe("admin navigation", () => {
  it("includes the customer enquiry inbox", () =>
    expect(adminNavigation.map((row) => row.label)).toEqual([
      "Overview",
      "Action centre",
      "Finance",
      "People",
      "Work",
      "Reviews",
      "Enquiries",
    ]));
  it.each([
    ["/admin/role-disputes", "/admin/action-centre"],
    ["/admin/placement-disputes", "/admin/action-centre"],
    ["/admin/disputes/history", "/admin/action-centre"],
    ["/admin/manual-payments", "/admin/finance"],
    ["/admin/settlements", "/admin/finance"],
    ["/admin/verifications", "/admin/reviews"],
    ["/admin/placements", "/admin/reviews"],
  ])("preserves active navigation for %s", (path, section) =>
    expect(adminSection(path)).toBe(section),
  );
});
