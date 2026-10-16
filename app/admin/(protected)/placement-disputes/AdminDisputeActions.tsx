import AdminEngagementDisputeActions from "@/components/admin/AdminEngagementDisputeActions";
export default function AdminDisputeActions({
  paymentId,
}: {
  paymentId: string;
}) {
  return (
    <AdminEngagementDisputeActions paymentId={paymentId} source="placement" />
  );
}
