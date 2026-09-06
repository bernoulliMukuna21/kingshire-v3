import { describe, expect, it } from "vitest";
import {
  getOrganisationPlan,
  ORGANISATION_PLANS,
} from "@/modules/organisations/domain/plans";
import { parseOrganisationSetup } from "@/modules/organisations/schemas/organisation-setup";

const REQUEST_KEY = "3f33f53f-0b4d-4d07-9c4d-18be3776b08d";

describe("Organisation subscription setup", () => {
  it("keeps the agreed monthly prices in one plan catalogue", () => {
    expect(
      ORGANISATION_PLANS.map(({ id, monthlyPriceGBP }) => ({
        id,
        monthlyPriceGBP,
      })),
    ).toEqual([
      { id: "starter", monthlyPriceGBP: 15 },
      { id: "growth", monthlyPriceGBP: 25 },
      { id: "scale", monthlyPriceGBP: 40 },
    ]);
  });

  it("keeps the agreed measurable allowances in the plan catalogue", () => {
    expect(
      ORGANISATION_PLANS.map(({ id, entitlements }) => ({
        id,
        ...entitlements,
      })),
    ).toEqual([
      {
        id: "starter",
        teammates: 3,
        volunteerSchemes: 1,
        paidPlacements: 2,
        activeParticipants: 3,
        reporting: "Basic",
      },
      {
        id: "growth",
        teammates: 10,
        volunteerSchemes: 3,
        paidPlacements: 6,
        activeParticipants: 10,
        reporting: "Team",
      },
      {
        id: "scale",
        teammates: 25,
        volunteerSchemes: 10,
        paidPlacements: 20,
        activeParticipants: 30,
        reporting: "Advanced",
      },
    ]);
  });

  it("normalises valid Organisation setup details", () => {
    expect(
      parseOrganisationSetup({
        request_key: REQUEST_KEY,
        plan_id: "growth",
        name: "  KingsHire Community  ",
        organisation_type: "community_group",
        country: "",
        website: "https://example.com",
      }),
    ).toEqual({
      requestKey: REQUEST_KEY,
      planId: "growth",
      profile: expect.objectContaining({
        name: "KingsHire Community",
        country: "United Kingdom",
        website: "https://example.com",
      }),
    });
  });

  it("rejects a plan that cannot map to a configured Stripe price", () => {
    expect(() =>
      parseOrganisationSetup({
        request_key: REQUEST_KEY,
        plan_id: "enterprise",
        name: "Test Organisation",
        organisation_type: "company",
      }),
    ).toThrowError("Select a valid Organisation plan.");
  });

  it("rejects an invalid idempotency request key", () => {
    expect(() =>
      parseOrganisationSetup({
        request_key: "repeat-me",
        plan_id: "starter",
        name: "Test Organisation",
        organisation_type: "company",
      }),
    ).toThrowError("The setup request is invalid.");
  });

  it("returns the selected plan without duplicating plan definitions", () => {
    expect(getOrganisationPlan("scale")).toMatchObject({
      name: "Scale",
      monthlyPriceGBP: 40,
    });
  });
});
