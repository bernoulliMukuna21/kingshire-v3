import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hasValidAdminSession } from "@/lib/admin-auth";
import { finalizeManualPayment } from "@/lib/db/payment-attempts";
import { notifyJobAwarded } from "@/lib/notifications";

// POST /api/admin/manual-payments/[id]/confirm
// Admin confirms a bank transfer has landed. [id] = payment attempt id.
// The manual equivalent of the payment_intent.succeeded webhook.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: attemptId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" || !(await hasValidAdminSession(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let result: Awaited<ReturnType<typeof finalizeManualPayment>>;
  try {
    result = await finalizeManualPayment(attemptId);
  } catch (err) {
    console.error("[admin/manual-payments/confirm] failed:", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "Could not confirm payment" },
      { status: 409 },
    );
  }

  const attempt = result.attempt;
  // Notify the worker they got the job (mirrors the webhook's notifyJobAwarded).
  if (result.finalizedNow && attempt) {
    const db = createServiceClient();
    const [{ data: worker }, { data: job }] = await Promise.all([
      db
        .from("profiles")
        .select("email")
        .eq("id", attempt.kinglancer_id)
        .single(),
      db.from("jobs").select("title").eq("id", attempt.job_id).single(),
    ]);
    if (worker?.email && job?.title) {
      notifyJobAwarded({
        kinglancerId: attempt.kinglancer_id,
        kinglancerEmail: worker.email,
        jobTitle: job.title,
      }).catch(() => {});
    }
  }

  return NextResponse.json({
    success: true,
    finalizedNow: result.finalizedNow,
  });
}
