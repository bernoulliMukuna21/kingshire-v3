import { sendEmail } from "./core";

export async function emailOrganisationInvitation({
  to,
  organisationName,
  inviterName,
  invitationUrl,
}: {
  to: string;
  organisationName: string;
  inviterName: string;
  invitationUrl: string;
}) {
  return sendEmail({
    to,
    subject: `Invitation to join ${organisationName} on KingsHire`,
    title: `Join ${organisationName}`,
    body: `${inviterName} has invited you to join their Organisation workspace on KingsHire.`,
    link: invitationUrl,
    ctaLabel: "Review invitation",
  });
}
