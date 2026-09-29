import type { SubscriptionRole } from "@/lib/subscriptions/plans";
import { ManageSubscriptionButton } from "./SubscriptionActions";

export function OtherRoleSubscription({ role }: { role: SubscriptionRole }) {
  return (
    <>
      <h2 className="text-base font-black text-slate-950">
        Your {role === "client" ? "Client" : "Kinglancer"} subscription is
        active
      </h2>
      <p className="mb-5 mt-1 text-sm text-slate-500">
        Its benefits apply in your {role} workspace. Switch back to that
        workspace to use them. You can manage or cancel this subscription below.
        Once it ends, you can subscribe for your current role. Switching
        workspaces does not change your subscription or start another charge.
      </p>
      <ManageSubscriptionButton />
    </>
  );
}
