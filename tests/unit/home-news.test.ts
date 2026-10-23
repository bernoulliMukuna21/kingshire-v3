import { describe, expect, it } from "vitest";
import {
  deriveHomeNews,
  homeAudience,
  showOrganisationDemo,
  type HomeProgress,
} from "@/lib/home-news";
const progress: HomeProgress = {
  peopleCount: 128,
  jobsCount: 150,
  kinglancersCount: 60,
  placementCount: 2,
  internshipCount: 1,
  leadingKinglancer: {
    id: "public-worker",
    name: "Public Worker",
    jobsCompleted: 21,
  },
};
describe("relevant community progress", () => {
  it("does not flash client promotions before authentication is known", () => {
    const audience = homeAudience({
      authReady: false,
      isLoggedIn: false,
      role: null,
    });
    expect(audience).toBeNull();
    expect(showOrganisationDemo(audience)).toBe(false);
    expect(deriveHomeNews(progress, audience)).toEqual([]);
  });
  it("offers the organisation demo to visitors and personal clients only", () => {
    expect(showOrganisationDemo("visitor")).toBe(true);
    expect(showOrganisationDemo("client")).toBe(true);
    for (const role of [
      "kinglancer",
      "organisation",
      "admin",
      "member",
    ] as const)
      expect(showOrganisationDemo(role)).toBe(false);
  });
  it("recognises organisation members without treating every logged-in client as an organisation", () => {
    expect(
      homeAudience({
        authReady: true,
        isLoggedIn: true,
        role: "client",
        hasOrganisation: true,
      }),
    ).toBe("organisation");
    expect(
      homeAudience({
        authReady: true,
        isLoggedIn: true,
        role: "client",
        hasOrganisation: false,
      }),
    ).toBe("client");
    expect(
      homeAudience({
        authReady: true,
        isLoggedIn: false,
        role: "client",
        hasOrganisation: true,
      }),
    ).toBe("visitor");
  });
  it("celebrates real milestones and links only to the public worker profile", () => {
    const news = deriveHomeNews(progress, "visitor");
    expect(news.find((row) => row.id === "community")?.text).toContain("120+");
    expect(news.find((row) => row.id === "achievement")).toMatchObject({
      href: "/kinglancers/public-worker",
      text: "Celebrating Public Worker: 21 jobs completed on KingsHire!",
    });
  });
  it("prioritises opportunities for Kinglancers and excludes organisation sales messages", () => {
    const news = deriveHomeNews(progress, "kinglancer");
    expect(news[0].id).toBe("internships");
    expect(
      news.some((row) => row.id === "organisations" || row.id === "team"),
    ).toBe(false);
  });
  it("prioritises team workspace news for organisation members", () => {
    const news = deriveHomeNews(progress, "organisation");
    expect(news[0]).toMatchObject({
      id: "team",
      href: "/dashboard/organisations",
    });
    expect(news.some((row) => row.id === "organisations")).toBe(false);
  });
  it("keeps personal client news focused on hiring and the community", () => {
    const news = deriveHomeNews(progress, "client");
    expect(news[0].id).toBe("achievement");
    expect(
      news.some((row) => row.id === "internships" || row.id === "placements"),
    ).toBe(false);
  });
  it("does not invent zero, stale or unavailable milestones", () => {
    expect(
      deriveHomeNews(
        {
          ...progress,
          peopleCount: null,
          leadingKinglancer: null,
          placementCount: null,
          internshipCount: null,
        },
        "member",
      ),
    ).toEqual([]);
    expect(
      deriveHomeNews(
        {
          ...progress,
          peopleCount: 0,
          leadingKinglancer: {
            ...progress.leadingKinglancer!,
            jobsCompleted: 0,
          },
          placementCount: 0,
          internshipCount: 0,
        },
        "kinglancer",
      ),
    ).toEqual([]);
  });
});
