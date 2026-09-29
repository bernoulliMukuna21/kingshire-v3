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
import { normalizeCurrencyAmount } from "@/lib/validation";
import { requireOrganisationPermission } from "@/lib/organisations";
import { captureServerEvent } from "@/lib/posthog-server";
import { requireTermsAccepted } from "@/lib/terms";
import { validateJobPostShape } from "./validateJobPostShape";
import { resolveJobSchedule } from "./resolveJobSchedule";
import { notifyMatchedKinglancers } from "./notifyMatchedKinglancers";
import { roleScheduleMeetsMinimumCharge } from "@/lib/settlement/role-schedule-policy";
import type { Cadence, SettlementMode } from "@/lib/settlement/types";

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
    posting_type,
    employment_type,
    pay_cadence,
    pay_amount,
    pay_negotiable,
    settlement_mode,
  } = body;

  const titleStr = (title ?? "").trim();
  const descStr = (description ?? "").trim();
  const isRole = posting_type === "role";
  const budgetNum = Number(budget);
  const normalizedBudget = normalizeCurrencyAmount(budgetNum);

  const shapeError = validateJobPostShape({
    isRole,
    titleStr,
    descStr,
    categories,
    budget,
    budgetNum,
    normalizedBudget,
    employment_type,
    pay_cadence,
    pay_negotiable,
    pay_amount,
    settlement_mode,
    organisationId,
    deadline,
  });
  if (shapeError)
    return NextResponse.json(
      { error: shapeError.error },
      { status: shapeError.status },
    );

  const validRateTypes = ["fixed", "per_hour", "per_day"];
  const resolvedRateType = validRateTypes.includes(rate_type)
    ? rate_type
    : "fixed";
  const invitedKinglancerId =
    typeof invited_kinglancer_id === "string" && invited_kinglancer_id.trim()
      ? invited_kinglancer_id.trim()
      : null;

  const schedule = await resolveJobSchedule({
    isRole,
    employment_type,
    work_mode,
    scheduled_at,
    ends_at,
    days_on_site,
    schedule_type,
    estimated_minutes,
    postcode,
    address_line,
    deadline,
  });
  if ("status" in schedule)
    return NextResponse.json(
      { error: schedule.error },
      { status: schedule.status },
    );
  const {
    resolvedWorkMode,
    addressStr,
    resolvedArea,
    resolvedPostcode,
    resolvedLat,
    resolvedLng,
    scheduledAtIso,
    endsAtIso,
    daysOnSite,
    resolvedScheduleType,
    resolvedEstimatedMinutes,
    resolvedDeadline,
  } = schedule;

  if (
    isRole &&
    employment_type === "temporary" &&
    !pay_negotiable &&
    scheduledAtIso &&
    endsAtIso &&
    !roleScheduleMeetsMinimumCharge({
      anchor: new Date(scheduledAtIso),
      boundEnd: new Date(endsAtIso),
      cadence: pay_cadence as Cadence,
      amountPerPeriod: Number(pay_amount),
      settlementMode: settlement_mode as SettlementMode,
    })
  ) {
    return NextResponse.json(
      {
        error:
          "The prorated pay for this temporary role is too small to process. Raise the pay amount or use a shorter pay cadence.",
      },
      { status: 400 },
    );
  }

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
        budget: isRole ? 0 : normalizedBudget,
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
        posting_type: isRole ? "role" : "gig",
        employment_type: isRole ? employment_type : null,
        pay_cadence: isRole ? pay_cadence : null,
        pay_amount: isRole && !pay_negotiable ? Number(pay_amount) : null,
        pay_negotiable: isRole ? !!pay_negotiable : false,
        settlement_mode: isRole ? settlement_mode : null,
      },
      { useServiceRole: !!organisationId },
    );

    jobCreated = true;

    await notifyMatchedKinglancers(job, invitedKinglancerId, normalizedBudget);

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
