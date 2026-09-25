// Single source of truth for an APPLICATION's status pill — shared by job
// applications and placement applications, whose statuses mean the same
// thing (see lib/hiring.ts for the offer lifecycle these values drive).

export type ApplicationStatus = "pending" | "offered" | "accepted" | "rejected";

const PILLS: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Pending review",
    className: "bg-yellow-50 text-yellow-700",
  },
  offered: { label: "Offer sent", className: "bg-blue-50 text-blue-700" },
  accepted: { label: "Selected", className: "bg-green-50 text-green-700" },
  rejected: { label: "Not selected", className: "bg-gray-100 text-gray-500" },
};

export function applicationStatusPill(status: string): {
  label: string;
  className: string;
} {
  return PILLS[status] ?? PILLS.pending;
}
