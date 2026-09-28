import { createServiceClient } from "@/lib/supabase/service";
import { jobAlertHeadline } from "@/lib/jobs";
import { formatMoney } from "@/lib/utils";
import { emailJobAlert } from "@/lib/notifications";
import { sendPushToUser } from "@/lib/push";

/** MVP-safe fan-out for a newly posted job: bounded in-app notifications
 * (inserted synchronously) plus fire-and-forget email/push so the HTTP
 * response never waits on either. Matching another user's email is a
 * privileged, cross-user read, so this always uses the service client. */
export async function notifyMatchedKinglancers(
  job: { id: string; title: string },
  invitedKinglancerId: string | null,
  normalizedBudget: number,
): Promise<void> {
  const db = createServiceClient();
  const { data: kinglancers } = invitedKinglancerId
    ? await db
        .from("profiles")
        .select("id, email")
        .eq("id", invitedKinglancerId)
        .limit(1)
    : await db
        .from("profiles")
        .select("id, email")
        .eq("role", "kinglancer")
        .order("jobs_completed", { ascending: false })
        .limit(50);

  if (!kinglancers?.length) return;

  const priceLabel = formatMoney(normalizedBudget);
  const headline = jobAlertHeadline(job.title, priceLabel);
  const alertTitle = invitedKinglancerId
    ? `Direct request: ${headline}`
    : headline;
  const alertBody = invitedKinglancerId
    ? `Congratulations 🎉! You have a new direct request! Log in now to review and respond.`
    : `Good News 😀! A new job just went live! Log in now to be one of the first to apply.`;
  const alertLink = `/jobs/${job.id}`;

  await createServiceClient()
    .from("notifications")
    .insert(
      kinglancers.map((k) => ({
        user_id: k.id,
        type: invitedKinglancerId ? "direct_request" : "new_job",
        title: alertTitle,
        body: alertBody,
        link: alertLink,
      })),
    )
    .then(() => null);

  // Fire-and-forget email fan-out — does not block the HTTP response.
  // ENABLE_EMAIL must be true in the environment for emails to actually send.
  Promise.allSettled(
    kinglancers
      .filter((k) => k.email)
      .map((k) =>
        emailJobAlert({
          to: k.email as string,
          jobTitle: job.title,
          priceLabel,
          jobId: job.id,
          isDirect: !!invitedKinglancerId,
        }),
      ),
  ).catch(() => {});

  // Fire-and-forget push fan-out — same bounded list as the in-app rows.
  Promise.allSettled(
    kinglancers.map((k) =>
      sendPushToUser(k.id, {
        title: alertTitle,
        body: alertBody,
        link: alertLink,
      }),
    ),
  ).catch(() => {});
}
