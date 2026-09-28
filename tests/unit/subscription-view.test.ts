import { expect, it } from "vitest";
import { deriveSubscriptionView } from "@/lib/subscriptions/view";
import type { UserSubscription } from "@/lib/subscriptions";
it("does not show benefits as unlocked for the wrong workspace", () => {
  const subscription = { isActive: true, role: "client" } as UserSubscription;
  expect(deriveSubscriptionView(subscription, "kinglancer")).toEqual({
    isActive: false,
    otherActiveRole: "client",
  });
  expect(deriveSubscriptionView(subscription, "client")).toEqual({
    isActive: true,
    otherActiveRole: null,
  });
});
it("allows a new subscription after the previous one ends", () => {
  expect(
    deriveSubscriptionView(
      { isActive: false, role: "client" } as UserSubscription,
      "kinglancer",
    ),
  ).toEqual({ isActive: false, otherActiveRole: null });
});
