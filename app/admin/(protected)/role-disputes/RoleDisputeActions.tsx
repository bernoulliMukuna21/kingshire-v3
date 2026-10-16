import AdminEngagementDisputeActions from "@/components/admin/AdminEngagementDisputeActions";
export default function RoleDisputeActions({
  paymentId,
}: {
  paymentId: string;
}) {
  return <AdminEngagementDisputeActions paymentId={paymentId} source="role" />;
}
