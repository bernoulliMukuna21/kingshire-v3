import { randomUUID } from "node:crypto";
import {
  canAttachJobFile,
  JOB_ATTACHMENT_BUCKET,
  JOB_ATTACHMENT_MAX_BYTES,
  jobAttachmentError,
  jobAttachmentContentType,
  type JobAttachment,
} from "@/lib/job-attachments";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOpenJobs, createJob } from "@/lib/db/jobs";
import { jobAlertHeadline } from "@/lib/jobs";
import { JOB_CATEGORIES } from "@/lib/job-categories";
import {
  hasValidCurrencyPrecision,
  normalizeCurrencyAmount,
} from "@/lib/validation";
import { MIN_JOB_BUDGET_GBP } from "@/lib/stripe";
import { lookupPostcode } from "@/lib/postcodes";
import { formatMoney } from "@/lib/utils";
import { emailJobAlert } from "@/lib/notifications";
import { sendPushToUser } from "@/lib/push";
import { requireOrganisationPermission } from "@/lib/organisations";
import { captureServerEvent } from "@/lib/posthog-server";
import { requireTermsAccepted } from "@/lib/terms";

export async function GET() {
  try {
    const jobs = await getOpenJobs();
    return NextResponse.json(jobs);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  if (!(await requireTermsAccepted(user.id))) {
    return NextResponse.json(
      {
        error: "Please accept our updated terms to continue.",
        needsTerms: true,
      },
      { status: 403 },
    );
  }

  let attachmentFile: File | null = null;
  let body;
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    if (
      Number(request.headers.get("content-length")) >
      JOB_ATTACHMENT_MAX_BYTES + 64 * 1024
    )
      return NextResponse.json(
        { error: "The attachment must be 3 MB or smaller." },
        { status: 413 },
      );
    try {
      const form = await request.formData();
      const payload = form.get("job");
      body = typeof payload === "string" ? JSON.parse(payload) : null;
      const files = form.getAll("attachment");
      if (
        files.length > 1 ||
        (files.length === 1 && !(files[0] instanceof File))
      )
        return NextResponse.json(
          { error: "Choose one supporting document." },
          { status: 400 },
        );
      attachmentFile = files[0] instanceof File ? files[0] : null;
    } catch {
      return NextResponse.json(
        { error: "Invalid job or attachment." },
        { status: 400 },
      );
    }
  } else {
    body = await request.json().catch(() => null);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }
  const organisationId =
    typeof body.organisation_id === "string" ? body.organisation_id : null;

  if (body.attachment != null)
    return NextResponse.json(
      { error: "Attach a file using the job posting form." },
      { status: 400 },
    );
  if (attachmentFile && !organisationId)
    return NextResponse.json(
      { error: "Attachments are available only for subscribed Organisations." },
      { status: 403 },
    );
  if (attachmentFile) {
    const fileError = jobAttachmentError(attachmentFile);
    if (fileError)
      return NextResponse.json({ error: fileError }, { status: 400 });
  }

  // Personal jobs require Client mode. Organisation jobs require membership.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const organisationMembership = organisationId
    ? await requireOrganisationPermission(
        organisationId,
        user.id,
        "manage_jobs",
      )
    : null;

  if (
    (!organisationId && (!profile || profile.role !== "client")) ||
    (organisationId && !organisationMembership)
  ) {
    return NextResponse.json(
      { error: "You do not have permission to post this job." },
      { status: 403 },
    );
  }

  if (organisationId) {
    const { data: subscription, error: subscriptionError } =
      await createServiceClient()
        .from("organisation_subscriptions")
        .select("status")
        .eq("organisation_id", organisationId)
        .maybeSingle();

    if (subscriptionError) {
      return NextResponse.json(
        { error: "Unable to verify the Organisation subscription." },
        { status: 503 },
      );
    }
    if (attachmentFile && !canAttachJobFile(subscription?.status)) {
      return NextResponse.json(
        {
          error:
            "An active Organisation subscription is required to attach a document.",
        },
        { status: 403 },
      );
    }
    // Organisations created before paid onboarding are intentionally
    // grandfathered. Once an Organisation has a subscription record, only an
    // active/trialling subscription may create new work.
    if (subscription && !canAttachJobFile(subscription.status)) {
      return NextResponse.json(
        {
          error:
            "Reactivate the Organisation subscription before posting new jobs.",
        },
        { status: 402 },
      );
    }
  }

  const {
    title,
    description,
    categories,
    budget,
    rate_type,
    deadline,
    invited_kinglancer_id,
    work_mode,
    address_line,
    postcode,
    scheduled_at,
    ends_at,
    days_on_site,
    schedule_type,
    estimated_minutes,
  } = body;

  const titleStr = (title ?? "").trim();
  const descStr = (description ?? "").trim();
  const budgetNum = Number(budget);
  const normalizedBudget = normalizeCurrencyAmount(budgetNum);

  if (!titleStr || !descStr || !categories?.length || !budget)
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  if (titleStr.length < 3 || titleStr.length > 120)
    return NextResponse.json(
      { error: "Title must be between 3 and 120 characters." },
      { status: 400 },
    );
  if (descStr.length < 10 || descStr.length > 2000)
    return NextResponse.json(
      { error: "Description must be between 10 and 2000 characters." },
      { status: 400 },
    );
  if (
    !Number.isFinite(budgetNum) ||
    !hasValidCurrencyPrecision(budget) ||
    normalizedBudget < MIN_JOB_BUDGET_GBP ||
    normalizedBudget > 50000
  )
    return NextResponse.json(
      {
        error: `Budget must be between £${MIN_JOB_BUDGET_GBP} and £50,000 with up to 2 decimals.`,
      },
      { status: 400 },
    );
  if (
    !Array.isArray(categories) ||
    categories.some(
      (c: string) => !(JOB_CATEGORIES as readonly string[]).includes(c),
    )
  )
    return NextResponse.json({ error: "Invalid category." }, { status: 400 });
  if (deadline) {
    const d = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (isNaN(d.getTime()) || d < today)
      return NextResponse.json(
        { error: "Deadline must be today or a future date." },
        { status: 400 },
      );
  }

  const validRateTypes = ["fixed", "per_hour", "per_day"];
  const resolvedRateType = validRateTypes.includes(rate_type)
    ? rate_type
    : "fixed";
  const invitedKinglancerId =
    typeof invited_kinglancer_id === "string" && invited_kinglancer_id.trim()
      ? invited_kinglancer_id.trim()
      : null;

  const validWorkModes = ["online", "in_person", "hybrid"];
  if (!validWorkModes.includes(work_mode)) {
    return NextResponse.json(
      { error: "Choose where the job happens." },
      { status: 400 },
    );
  }
  const resolvedWorkMode = work_mode;
  const addressStr =
    typeof address_line === "string" ? address_line.trim() : "";
  const postcodeStr = typeof postcode === "string" ? postcode.trim() : "";
  let resolvedArea: string | null = null;
  let resolvedPostcode: string | null = null;
  let resolvedLat: number | null = null;
  let resolvedLng: number | null = null;
  let scheduledAtIso: string | null = null;
  let endsAtIso: string | null = null;
  let daysOnSite: number | null = null;
  if (resolvedWorkMode === "online") {
    const start = new Date(scheduled_at);
    const end = new Date(ends_at);
    if (!scheduled_at || isNaN(start.getTime())) {
      return NextResponse.json(
        { error: "Add the start date." },
        { status: 400 },
      );
    }
    if (!ends_at || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Add the end date." }, { status: 400 });
    }
    if (end.getTime() < start.getTime()) {
      return NextResponse.json(
        { error: "The end date must be after the start date." },
        { status: 400 },
      );
    }
    scheduledAtIso = start.toISOString();
    endsAtIso = end.toISOString();
  }
  if (resolvedWorkMode === "in_person" || resolvedWorkMode === "hybrid") {
    if (!addressStr) {
      return NextResponse.json(
        { error: "Add the street address for an in-person or hybrid job." },
        { status: 400 },
      );
    }
    const geo = await lookupPostcode(postcodeStr);
    if (!geo) {
      return NextResponse.json(
        { error: "Enter a valid UK postcode." },
        { status: 400 },
      );
    }
    resolvedArea = geo.area;
    resolvedPostcode = geo.postcode;
    resolvedLat = geo.latitude;
    resolvedLng = geo.longitude;
  }
  if (resolvedWorkMode === "in_person") {
    const startHasTime =
      typeof scheduled_at === "string" && /T\d{2}:\d{2}/.test(scheduled_at);
    const endHasTime =
      typeof ends_at === "string" && /T\d{2}:\d{2}/.test(ends_at);
    const start = new Date(scheduled_at);
    const end = new Date(ends_at);
    if (!startHasTime || isNaN(start.getTime())) {
      return NextResponse.json(
        { error: "Add the start date and time." },
        { status: 400 },
      );
    }
    if (!endHasTime || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: "Add the end date and time." },
        { status: 400 },
      );
    }
    if (end.getTime() <= start.getTime()) {
      return NextResponse.json(
        { error: "The end time must be after the start time." },
        { status: 400 },
      );
    }
    scheduledAtIso = start.toISOString();
    endsAtIso = end.toISOString();
  }
  if (resolvedWorkMode === "hybrid") {
    daysOnSite = Number(days_on_site);
    if (!Number.isInteger(daysOnSite) || daysOnSite < 1 || daysOnSite > 6) {
      return NextResponse.json(
        {
          error: "Set how many days on-site per week (1–6) for a hybrid job.",
        },
        { status: 400 },
      );
    }
    const start = new Date(scheduled_at);
    const end = new Date(ends_at);
    if (!scheduled_at || isNaN(start.getTime())) {
      return NextResponse.json(
        { error: "Add the start date." },
        { status: 400 },
      );
    }
    if (!ends_at || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Add the end date." }, { status: 400 });
    }
    if (end.getTime() < start.getTime()) {
      return NextResponse.json(
        { error: "The end date must be after the start date." },
        { status: 400 },
      );
    }
    scheduledAtIso = start.toISOString();
    endsAtIso = end.toISOString();
  }

  // Schedule type only applies to in-person timed jobs: a fixed 'shift' vs a
  // 'window' to complete the task. Online/hybrid stay 'window'. The optional
  // duration estimate is kept only for in-person window jobs.
  const resolvedScheduleType =
    resolvedWorkMode === "in_person" && schedule_type === "shift"
      ? "shift"
      : "window";
  let resolvedEstimatedMinutes: number | null = null;
  if (
    resolvedWorkMode === "in_person" &&
    resolvedScheduleType === "window" &&
    estimated_minutes != null
  ) {
    const m = Number(estimated_minutes);
    if (Number.isInteger(m) && m >= 15 && m <= 1440)
      resolvedEstimatedMinutes = m;
  }

  // Every job now carries a start/end window; the end date backs the legacy
  // deadline column (job expiry, list displays) for continuity.
  const resolvedDeadline = endsAtIso
    ? endsAtIso.slice(0, 10)
    : deadline || null;

  if (invitedKinglancerId) {
    const { data: invitedKinglancer } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", invitedKinglancerId)
      .eq("role", "kinglancer")
      .single();

    if (!invitedKinglancer) {
      return NextResponse.json(
        { error: "Selected Kinglancer was not found." },
        { status: 404 },
      );
    }
  }

  const jobId = randomUUID();
  let attachment: JobAttachment | null = null;
  let jobCreated = false;
  try {
    if (attachmentFile && organisationId) {
      const path = `${organisationId}/${jobId}/${randomUUID()}`;
      const contentType = jobAttachmentContentType(attachmentFile.name);
      const { error: uploadError } = await createServiceClient()
        .storage.from(JOB_ATTACHMENT_BUCKET)
        .upload(path, await attachmentFile.arrayBuffer(), {
          contentType,
          upsert: false,
        });
      if (uploadError)
        return NextResponse.json(
          {
            error:
              "The document could not be uploaded. Your job has not been posted. Please try again.",
          },
          { status: 503 },
        );
      attachment = {
        path,
        name: attachmentFile.name,
        size: attachmentFile.size,
        contentType,
      };
    }
    const job = await createJob(
      {
        id: jobId,
        ...(attachment ? { attachment } : {}),
        client_id: user.id,
        created_by: user.id,
        organisation_id: organisationId,
        title: titleStr,
        description: descStr,
        categories,
        budget: normalizedBudget,
        rate_type: resolvedRateType,
        work_mode: resolvedWorkMode,
        location: resolvedArea,
        address_line: resolvedWorkMode !== "online" ? addressStr : null,
        postcode: resolvedPostcode,
        location_area: resolvedArea,
        latitude: resolvedLat,
        longitude: resolvedLng,
        scheduled_at: scheduledAtIso,
        ends_at: endsAtIso,
        days_on_site: daysOnSite,
        schedule_type: resolvedScheduleType,
        estimated_minutes: resolvedEstimatedMinutes,
        invited_kinglancer_id: invitedKinglancerId,
        direct_request_status: invitedKinglancerId ? "pending" : null,
        deadline: resolvedDeadline,
      },
      { useServiceRole: !!organisationId },
    );

    jobCreated = true;

    // MVP-safe fan-out: create bounded in-app notifications only.
    // Avoid sending one email per kinglancer during the job-post request.
    const { data: kinglancers } = invitedKinglancerId
      ? await supabase
          .from("profiles")
          .select("id, email")
          .eq("id", invitedKinglancerId)
          .limit(1)
      : await supabase
          .from("profiles")
          .select("id, email")
          .eq("role", "kinglancer")
          .order("jobs_completed", { ascending: false })
          .limit(50);

    const priceLabel = formatMoney(normalizedBudget);
    const headline = jobAlertHeadline(job.title, priceLabel);
    const alertTitle = invitedKinglancerId
      ? `Direct request: ${headline}`
      : headline;
    const alertBody = invitedKinglancerId
      ? `Congratulations 🎉! You have a new direct request! Log in now to review and respond.`
      : `Good News 😀! A new job just went live! Log in now to be one of the first to apply.`;
    const alertLink = `/jobs/${job.id}`;

    if (kinglancers?.length) {
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
    }

    // Fire-and-forget email fan-out — does not block the HTTP response.
    // ENABLE_EMAIL must be true in the environment for emails to actually send.
    if (kinglancers?.length) {
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

    if (!invitedKinglancerId) {
      revalidateTag("open-jobs", "max");
    }

    await captureServerEvent({
      distinctId: user.id,
      event: "job_posted",
      properties: {
        job_id: job.id,
        budget: normalizedBudget,
        category_count: categories.length,
        is_direct_request: Boolean(invitedKinglancerId),
        rate_type: resolvedRateType,
      },
    });

    return NextResponse.json(job, { status: 201 });
  } catch {
    if (attachment && !jobCreated) {
      const { error: cleanupError } = await createServiceClient()
        .storage.from(JOB_ATTACHMENT_BUCKET)
        .remove([attachment.path]);
      if (cleanupError)
        console.error("[job attachment] cleanup failed", cleanupError.message);
    }
    return NextResponse.json(
      { error: "Failed to create job" },
      { status: 500 },
    );
  }
}
