import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getJobById } from "@/lib/db/jobs";
import type { RateType } from "@/lib/jobs";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyJobCancelled } from "@/lib/notifications";
import { JOB_CATEGORIES } from "@/lib/job-categories";
import {
  hasValidCurrencyPrecision,
  normalizeCurrencyAmount,
} from "@/lib/validation";
import { canManageJob } from "@/lib/organisations";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const job = await getJobById(id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json(job);
  } catch {
    return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const job = await getJobById(id, { useServiceRole: true });
  if (!job)
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!(await canManageJob(job, user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!["open", "cancelled"].includes(job.status)) {
    return NextResponse.json(
      {
        error:
          "Only open or cancelled jobs can be deleted. Use the dispute system for active jobs.",
      },
      { status: 409 },
    );
  }

  const db = createServiceClient();

  // Notify applicants on open jobs before the cascade delete removes their records.
  // Two separate queries avoids Supabase's embedded-join type inference issues
  // and is easier to read: first get kinglancer IDs, then resolve their emails.
  if (job.status === "open") {
    const { data: apps } = await db
      .from("applications")
      .select("kinglancer_id")
      .eq("job_id", id)
      .neq("status", "rejected");

    if (apps?.length) {
      const kinglancerIds = apps.map((a) => a.kinglancer_id);
      const { data: kinglancers } = await db
        .from("profiles")
        .select("id, email")
        .in("id", kinglancerIds);

      if (kinglancers?.length) {
        Promise.allSettled(
          kinglancers.map((k) =>
            notifyJobCancelled({
              recipientId: k.id,
              recipientEmail: k.email,
              jobTitle: job.title,
              refunded: false,
            }),
          ),
        ).catch(() => {});
      }
    }
  }

  // Delete job — ON DELETE CASCADE removes applications automatically
  const { error } = await db.from("jobs").delete().eq("id", id);
  if (error)
    return NextResponse.json(
      { error: "Failed to delete job" },
      { status: 500 },
    );

  revalidateTag("open-jobs", { expire: 0 });

  return NextResponse.json({ deleted: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const job = await getJobById(id, { useServiceRole: true });
  if (!job)
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (!(await canManageJob(job, user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (job.status !== "open")
    return NextResponse.json(
      { error: "Only open jobs can be edited." },
      { status: 409 },
    );

  // Check for applicants — budget is locked once anyone has applied
  const { count: applicantCount } = await createServiceClient()
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("job_id", id)
    .neq("status", "rejected");

  const hasApplicants = (applicantCount ?? 0) > 0;

  const body = await request.json();
  const { title, description, categories, budget, rate_type, deadline } = body;

  const titleStr = (title ?? "").trim();
  const descStr = (description ?? "").trim();
  const budgetNum = Number(budget);
  const normalizedBudget = normalizeCurrencyAmount(budgetNum);

  if (!titleStr || titleStr.length < 3 || titleStr.length > 120)
    return NextResponse.json(
      { error: "Title must be between 3 and 120 characters." },
      { status: 400 },
    );
  if (!descStr || descStr.length < 10 || descStr.length > 2000)
    return NextResponse.json(
      { error: "Description must be between 10 and 2000 characters." },
      { status: 400 },
    );
  // Only validate + apply budget/rate changes when there are no applicants
  if (!hasApplicants) {
    if (
      !Number.isFinite(budgetNum) ||
      !hasValidCurrencyPrecision(budget) ||
      normalizedBudget < 20 ||
      normalizedBudget > 50000
    )
      return NextResponse.json(
        {
          error:
            "Budget must be between £20 and £50,000 with up to 2 decimals.",
        },
        { status: 400 },
      );
  }

  if (
    !Array.isArray(categories) ||
    categories.length === 0 ||
    categories.some(
      (c: string) => !(JOB_CATEGORIES as readonly string[]).includes(c),
    )
  )
    return NextResponse.json(
      { error: "At least one valid category is required." },
      { status: 400 },
    );

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

  type JobUpdate = {
    title: string;
    description: string;
    categories: string[];
    deadline: string | null;
    budget?: number;
    rate_type?: RateType;
  };

  const updatePayload: JobUpdate = {
    title: titleStr,
    description: descStr,
    categories,
    deadline: deadline || null,
  };

  // Only update budget + rate_type when no one has applied
  if (!hasApplicants) {
    updatePayload.budget = normalizedBudget;
    updatePayload.rate_type = resolvedRateType as
      | "fixed"
      | "per_hour"
      | "per_day";
  }

  const { error } = await createServiceClient()
    .from("jobs")
    .update(updatePayload)
    .eq("id", id)
    .eq("status", "open"); // idempotency guard — only update if still open

  if (error)
    return NextResponse.json(
      { error: "Failed to update job" },
      { status: 500 },
    );

  revalidateTag("open-jobs", { expire: 0 });

  return NextResponse.json({ updated: true, budgetLocked: hasApplicants });
}
