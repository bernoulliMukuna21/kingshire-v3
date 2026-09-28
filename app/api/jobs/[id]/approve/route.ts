import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { canManageJob } from "@/lib/organisations";
import { approveJobPayment } from "@/lib/settlement/job-payments";

// POST /api/jobs/[id]/approve — client approves completed work, releases payment
export async function POST(
  _request: Request,
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

  // Fetch job and verify caller is the client
  const { data: job } = await createServiceClient()
    .from("jobs")
    .select("id, status, client_id, organisation_id, kinglancer_id, title")
    .eq("id", jobId)
    .single();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (!(await canManageJob(job, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (job.status !== "completed") {
    return NextResponse.json(
      { error: "Work has not been marked as complete yet" },
      { status: 409 },
    );
  }

  try {
    const result = await approveJobPayment(jobId);
    revalidateTag("kinglancer-profiles", { expire: 0 });
    return NextResponse.json({
      success: true,
      manual: result === "manual",
      result,
    });
  } catch (error) {
    console.error("[approve]", error);
    return NextResponse.json(
      {
        error:
          "Payment could not be released. Check its status before retrying.",
      },
      { status: 409 },
    );
  }
}
