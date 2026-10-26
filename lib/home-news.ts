import { formatMilestoneCount } from "@/lib/format-stats";
export type HomeAudience =
  "visitor" | "client" | "kinglancer" | "organisation" | "admin" | "member";
export type HomeProgress = {
  peopleCount: number | null;
  jobsCount: number | null;
  kinglancersCount: number | null;
  placementCount: number | null;
  internshipCount: number | null;
  leadingKinglancer: { id: string; name: string; jobsCompleted: number } | null;
};
export function homeAudience(input: {
  authReady: boolean;
  isLoggedIn: boolean;
  role: string | null;
  hasOrganisation?: boolean;
}): HomeAudience | null {
  if (!input.authReady) return null;
  if (!input.isLoggedIn) return "visitor";
  if (input.role === "admin") return "admin";
  if (input.role === "kinglancer") return "kinglancer";
  if (input.role === "client")
    return input.hasOrganisation ? "organisation" : "client";
  return "member";
}
export function showOrganisationDemo(audience: HomeAudience | null) {
  return audience === "visitor" || audience === "client";
}
export type HomeNews = {
  id: string;
  text: string;
  href: string;
  linkLabel: string;
};
export function deriveHomeNews(
  progress: HomeProgress,
  audience: HomeAudience | null,
): HomeNews[] {
  if (!audience) return [];
  const stories: HomeNews[] = [];
  if ((progress.peopleCount ?? 0) > 0)
    stories.push({
      id: "community",
      text: `${formatMilestoneCount(progress.peopleCount!)} people have joined KingsHire. Thank you for growing this community.`,
      href: "/kinglancers",
      linkLabel: "Meet the community",
    });
  const leader = progress.leadingKinglancer;
  if (leader && leader.jobsCompleted > 0 && leader.name.trim())
    stories.push({
      id: "achievement",
      text: `Celebrating ${leader.name}: ${leader.jobsCompleted} ${leader.jobsCompleted === 1 ? "job" : "jobs"} completed on KingsHire!`,
      href: `/kinglancers/${leader.id}`,
      linkLabel: "Meet our community achiever",
    });
  if (["visitor", "kinglancer", "organisation", "admin"].includes(audience)) {
    if ((progress.internshipCount ?? 0) > 0)
      stories.push({
        id: "internships",
        text: `${progress.internshipCount} ${progress.internshipCount === 1 ? "internship is" : "internships are"} live on KingsHire. More ways to build experience.`,
        href: "/placements",
        linkLabel: "Explore internships and placements",
      });
    if ((progress.placementCount ?? 0) > (progress.internshipCount ?? 0))
      stories.push({
        id: "placements",
        text: `${progress.placementCount} ${progress.placementCount === 1 ? "placement opportunity is" : "placement opportunities are"} live. Creating more chances to learn and contribute.`,
        href: "/placements",
        linkLabel: "Explore placements",
      });
  }
  if (audience === "visitor" || audience === "client")
    stories.push({
      id: "organisations",
      text: "Organisations can now post work, invite colleagues and manage hiring together.",
      href: "/organisation",
      linkLabel: "Explore organisation workspaces",
    });
  if (audience === "organisation")
    stories.push({
      id: "team",
      text: "Your team can create jobs and placements together in your organisation workspace.",
      href: "/dashboard/organisations",
      linkLabel: "Open your organisation workspace",
    });
  const priority =
    audience === "kinglancer"
      ? ["internships", "placements", "achievement", "community"]
      : audience === "organisation"
        ? ["team", "placements", "internships", "achievement", "community"]
        : audience === "client"
          ? ["achievement", "community", "organisations"]
          : [];
  return priority.length
    ? stories.sort((a, b) => priority.indexOf(a.id) - priority.indexOf(b.id))
    : stories;
}
