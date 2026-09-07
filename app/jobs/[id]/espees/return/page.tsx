import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getPaymentAttemptById,
  finalizeEspeesPayment,
} from "@/lib/db/payment-attempts";
import { confirmEspeesPayment } from "@/lib/espees";

// Espees redirect-back target (the product's success_url). We confirm the
// payment server-side and, if approved, finalize the escrow (idempotent).
// Anything left PENDING is picked up by the reconciliation job.
export default async function EspeesReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attempt?: string }>;
}) {
  const { id: jobId } = await params;
  const { attempt: attemptId } = await searchParams;

  if (!attemptId) redirect(`/jobs/${jobId}`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const attempt = await getPaymentAttemptById(attemptId);
  if (
    !attempt ||
    attempt.job_id !== jobId ||
    attempt.client_id !== user.id ||
    attempt.method !== "espees" ||
    !attempt.espees_payment_ref
  ) {
    redirect(`/jobs/${jobId}`);
  }

  let status: string;
  try {
    const result = await confirmEspeesPayment(attempt.espees_payment_ref);
    status = result.status;
  } catch {
    // Confirm endpoint unreachable — the reconciliation job will settle it.
    redirect(`/jobs/${jobId}?espees=pending`);
  }

  if (status === "APPROVED") {
    await finalizeEspeesPayment(attempt.id);
    redirect(`/jobs/${jobId}?espees=funded`);
  }

  if (status === "PENDING") {
    redirect(`/jobs/${jobId}?espees=pending`);
  }

  redirect(`/jobs/${jobId}?espees=failed`);
}
