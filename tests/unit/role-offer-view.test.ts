import { describe, expect, it } from "vitest";
import { deriveRoleOfferView, rolePayLabel } from "@/lib/role-offer-view";

describe("role offer presentation", () => {
  it("does not describe a closed offer as a completed hire", () => {
    expect(deriveRoleOfferView("cancelled")).toMatchObject({ label: "Offer closed", recipientLabel: "Offer to", canManage: false });
  });
  it("distinguishes acceptance from funding and active work", () => {
    expect(deriveRoleOfferView("pending_acceptance").label).toBe("Awaiting response");
    expect(deriveRoleOfferView("pending_funding").label).toBe("Accepted · awaiting funding");
    expect(deriveRoleOfferView("active").label).toBe("Agreement active");
    expect(deriveRoleOfferView("ended").canManage).toBe(false);
  });
  it("does not assume an unknown status means completion", () => {
    expect(deriveRoleOfferView("unknown").label).toBe("Status unavailable");
  });
  it("formats pay consistently while retaining pence", () => {
    expect(rolePayLabel("1800", "monthly")).toBe("£1,800 per month");
    expect(rolePayLabel(28.5, "weekly")).toBe("£28.50 per week");
  });
});
