import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getJobById } from "@/lib/db/jobs";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyJobCancelled } from "@/lib/notifications";

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

  const job = await getJobById(id);
  if (!job)
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.client_id !== user.id)
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
