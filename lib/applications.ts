// Single source of truth for a job APPLICATION's status pill.

export type ApplicationStatus = "pending" | "accepted" | "rejected";

const PILLS: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Pending review",
    className: "bg-yellow-50 text-yellow-700",
  },
  accepted: { label: "Selected", className: "bg-green-50 text-green-700" },
  rejected: { label: "Not selected", className: "bg-gray-100 text-gray-500" },
};

export function applicationStatusPill(status: string): {
  label: string;
  className: string;
} {
  return PILLS[status] ?? PILLS.pending;
}
