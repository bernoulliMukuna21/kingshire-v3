import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  hasValidCurrencyPrecision,
  normalizeCurrencyAmount,
} from "@/lib/validation";

const VALID_RATE_TYPES = ["fixed", "per_hour", "per_day"];

type DirectRequestJob = {
  id: string;
  client_id: string;
  invited_kinglancer_id: string | null;
  direct_request_status:
    | "pending"
    | "changes_requested"
    | "accepted_pending_payment"
    | "declined"
    | "cancelled"
    | null;
  status: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { data: jobRaw } = await supabase
    .from("jobs")
    .select(
      "id, client_id, invited_kinglancer_id, direct_request_status, status",
    )
    .eq("id", jobId)
    .single();

  if (!jobRaw) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const job = jobRaw as DirectRequestJob;
  if (!job.invited_kinglancer_id || !job.direct_request_status) {
    return NextResponse.json(
      { error: "This is not a direct request." },
      { status: 400 },
    );
  }
  if (job.status !== "open") {
    return NextResponse.json(
      { error: "This request is no longer open." },
      { status: 409 },
    );
  }

  const body = await request.json();
  const action = body.action as string | undefined;
  const db = createServiceClient();

  if (action === "accept") {
    if (user.id !== job.invited_kinglancer_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: updatedJob, error } = await db
      .from("jobs")
      .update({
        direct_request_status: "accepted_pending_payment",
        direct_request_message: null,
        counter_budget: null,
        counter_rate_type: null,
        counter_deadline: null,
      })
      .eq("id", jobId)
      .eq("invited_kinglancer_id", user.id)
      .eq("status", "open")
      .in("direct_request_status", ["pending", "changes_requested"])
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Failed to accept request." },
        { status: 500 },
      );
    }
    if (!updatedJob) {
      return NextResponse.json(
        { error: "This request is no longer available." },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true });
  }

  if (action === "decline") {
    if (user.id !== job.invited_kinglancer_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: updatedJob, error } = await db
      .from("jobs")
      .update({ direct_request_status: "declined" })
      .eq("id", jobId)
      .eq("invited_kinglancer_id", user.id)
      .eq("status", "open")
      .in("direct_request_status", ["pending", "changes_requested"])
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Failed to decline request." },
        { status: 500 },
      );
    }
    if (!updatedJob) {
      return NextResponse.json(
        { error: "This request is no longer available." },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true });
  }

  if (action === "request_changes") {
    if (user.id !== job.invited_kinglancer_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const message = String(body.message ?? "").trim();
    const proposedBudget = body.proposed_budget;
    const proposedRateType = String(body.proposed_rate_type ?? "fixed");
    const proposedDeadline = body.proposed_deadline
      ? String(body.proposed_deadline)
      : null;

    if (message.length < 10) {
      return NextResponse.json(
        { error: "Please explain the changes you need." },
        { status: 400 },
      );
    }
    if (
      !hasValidCurrencyPrecision(proposedBudget) ||
      Number(proposedBudget) < 20 ||
      Number(proposedBudget) > 50000
    ) {
      return NextResponse.json(
        { error: "Proposed budget must be between £20 and £50,000." },
        { status: 400 },
      );
    }
    if (!VALID_RATE_TYPES.includes(proposedRateType)) {
      return NextResponse.json(
        { error: "Invalid rate type." },
        { status: 400 },
      );
    }
    if (proposedDeadline) {
      const deadline = new Date(proposedDeadline);
      if (isNaN(deadline.getTime()) || deadline <= new Date()) {
        return NextResponse.json(
          { error: "Proposed deadline must be a future date." },
          { status: 400 },
        );
      }
    }

    const { data: updatedJob, error } = await db
      .from("jobs")
      .update({
        direct_request_status: "changes_requested",
        direct_request_message: message,
        counter_budget: normalizeCurrencyAmount(proposedBudget),
        counter_rate_type: proposedRateType,
        counter_deadline: proposedDeadline,
      })
      .eq("id", jobId)
      .eq("invited_kinglancer_id", user.id)
      .eq("status", "open")
      .in("direct_request_status", ["pending", "changes_requested"])
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Failed to request changes." },
        { status: 500 },
      );
    }
    if (!updatedJob) {
      return NextResponse.json(
        { error: "This request is no longer available." },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true });
  }

  if (action === "accept_changes") {
    if (user.id !== job.client_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: currentJob } = await supabase
      .from("jobs")
      .select("counter_budget, counter_rate_type, counter_deadline")
      .eq("id", jobId)
      .single();

    if (!currentJob?.counter_budget || !currentJob.counter_rate_type) {
      return NextResponse.json(
        { error: "No requested changes are available." },
        { status: 409 },
      );
    }

    const { data: updatedJob, error } = await db
      .from("jobs")
      .update({
        budget: currentJob.counter_budget,
        rate_type: currentJob.counter_rate_type,
        deadline: currentJob.counter_deadline,
        direct_request_status: "accepted_pending_payment",
        direct_request_message: null,
        counter_budget: null,
        counter_rate_type: null,
        counter_deadline: null,
      })
      .eq("id", jobId)
      .eq("client_id", user.id)
      .eq("status", "open")
      .eq("direct_request_status", "changes_requested")
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Failed to accept changes." },
        { status: 500 },
      );
    }
    if (!updatedJob) {
      return NextResponse.json(
        { error: "This request is no longer available." },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true });
  }

  if (action === "cancel") {
    if (user.id !== job.client_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: updatedJob, error } = await db
      .from("jobs")
      .update({ direct_request_status: "cancelled" })
      .eq("id", jobId)
      .eq("client_id", user.id)
      .eq("status", "open")
      .in("direct_request_status", [
        "pending",
        "changes_requested",
        "accepted_pending_payment",
      ])
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Failed to cancel request." },
        { status: 500 },
      );
    }
    if (!updatedJob) {
      return NextResponse.json(
        { error: "This request is no longer available." },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
