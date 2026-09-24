import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ single: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ stripe: { transfers: { create: mocks.create } } }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ single: mocks.single }) }) }) }) }));
import { fireTransfer } from "@/lib/stripe-connect";
const args = { transactionId: "tx", jobId: "job", amountPence: 3325, destinationAccountId: "acct" };
beforeEach(() => vi.clearAllMocks());
it.each([
  { status: "held", payout_method: "manual", manual_payout_reference: "Bank payment confirmed", stripe_transfer_id: null },
  { status: "released", payout_method: "manual", manual_payout_reference: null, stripe_transfer_id: null },
])("blocks manually settled transactions before contacting Stripe", async (data) => {
  mocks.single.mockResolvedValue({ data, error: null });
  await expect(fireTransfer(args)).rejects.toThrow("settled manually");
  expect(mocks.create).not.toHaveBeenCalled();
});
it("fails closed when the database lookup fails", async () => {
  mocks.single.mockResolvedValue({ data: null, error: { message: "unavailable" } });
  await expect(fireTransfer(args)).rejects.toThrow("Cannot verify");
  expect(mocks.create).not.toHaveBeenCalled();
});
it("does not repeat a recorded Stripe transfer", async () => {
  mocks.single.mockResolvedValue({ data: { stripe_transfer_id: "tr_existing", payout_method: "stripe", status: "released", manual_payout_reference: null }, error: null });
  await fireTransfer(args);
  expect(mocks.create).not.toHaveBeenCalled();
});
