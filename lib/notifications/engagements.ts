import { sendEmail } from "./core";

/** Shared by org roles and placements — both are `engagements` under the hood.
 * Warns the organisation that a period is about to release so they have a
 * window to dispute it first. */
export async function notifyEngagementReleasePending({
  organisationEmail,
  title,
  link,
  periodIndex,
  releaseDate,
}: {
  organisationEmail: string;
  title: string;
  link: string;
  periodIndex: number;
  releaseDate: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://kingshire.uk";
  await sendEmail({
    to: organisationEmail,
    subject: `Period ${periodIndex} for "${title}" releases on ${releaseDate}`,
    title: "This period's payment is about to be released",
    body: `Period ${periodIndex} for "${title}" will be released to the Kinglancer on ${releaseDate} unless you flag an issue. If something isn't right, open it and dispute this period before then.`,
    link: `${appUrl}${link}`,
    ctaLabel: "Review this period →",
  });
}
