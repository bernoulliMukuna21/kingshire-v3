import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  available: 25773,
  receipt: { status: "pending", net: 3468 } as {
    status: string;
    net: number;
  } | null,
  rows: [] as Record<string, unknown>[],
  charges: vi.fn(),
}));
async function* records(rows: unknown[]) {
  yield* rows;
}
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("@/lib/admin/access", () => ({
  getAdminDb: async () => ({
    from: (table: string) => ({
      select: () => ({
        order: () => ({
          range: async (from: number, to: number) => ({
            data:
              table === "transactions" ? state.rows.slice(from, to + 1) : [],
            error: null,
          }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/lib/stripe", () => ({
  stripe: {
    balance: {
      retrieve: async () => ({
        livemode: true,
        available: [{ currency: "gbp", amount: state.available }],
        pending: [{ currency: "gbp", amount: 3468 }],
      }),
    },
    balanceTransactions: {
      list: () =>
        records([
          {
            currency: "gbp",
            type: "payment",
            amount: 3588,
            fee: 120,
            net: 3468,
          },
        ]),
    },
    charges: {
      list: (args: unknown) => {
        state.charges(args);
        return records([
          {
            id: "ch_job",
            payment_intent: "pi_job",
            amount: 3588,
            amount_refunded: 0,
            paid: true,
            balance_transaction: state.receipt,
          },
        ]);
      },
    },
    transfers: { list: () => records([]) },
    invoicePayments: { list: () => records([]) },
  },
}));
import { getAdminFinances } from "@/lib/admin/finances";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_ENV", "production");
  state.available = 25773;
  state.receipt = { status: "pending", net: 3468 };
  state.rows = [
    {
      id: "payment",
      stripe_payment_intent_id: "pi_job",
      status: "held",
      amount: "35",
      platform_fee_client: "0.88",
      platform_fee_kinglancer: "1.75",
      payment_method: "card",
      manual_payout_reference: null,
      stripe_transfer_id: null,
      stripe_refund_id: null,
      release_outcome: null,
    },
  ];
});
describe("live finance funding projection", () => {
  it("uses the matched receipt's pending state rather than deducting its gross from available cash", async () => {
    const view = await getAdminFinances();
    expect(view.reconciliation?.issues).toEqual([]);
    expect(view.summary?.estimatedWithdrawableGBP).toBe(257.73);
    expect(state.charges).toHaveBeenCalledWith({
      limit: 100,
      expand: ["data.balance_transaction"],
    });
  });
  it("keeps company money stable after the same receipt enters the available balance", async () => {
    state.available += 3468;
    state.receipt!.status = "available";
    expect((await getAdminFinances()).summary?.estimatedWithdrawableGBP).toBe(
      257.73,
    );
  });
  it("does not turn missing funding settlement details into a confident balance", async () => {
    state.receipt = null;
    expect(
      (await getAdminFinances()).summary?.estimatedWithdrawableGBP,
    ).toBeNull();
  });
});
