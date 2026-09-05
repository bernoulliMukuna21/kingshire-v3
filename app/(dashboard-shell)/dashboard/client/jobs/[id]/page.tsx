import JobDetailWorkspace from "@/components/jobs/JobDetailWorkspace";

export default async function ClientJobWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment_failed?: string; from?: string }>;
}) {
  const { id } = await params;
  const { payment_failed, from } = await searchParams;

  return (
    <JobDetailWorkspace jobId={id} from={from} paymentFailed={payment_failed} />
  );
}
