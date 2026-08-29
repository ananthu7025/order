type Status =
  | "NEW"
  | "CONTACTED"
  | "INTERESTED"
  | "QUOTED"
  | "WON"
  | "LOST"
  | "DRAFT"
  | "PUBLISHED"
  | "INACTIVE"
  | "SENT"
  | "ACCEPTED"
  | "REVISION_REQUESTED"
  | "DECLINED"
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID";

const STATUS_MAP: Record<Status, { label: string; className: string }> = {
  NEW: { label: "New", className: "pill-green" },
  CONTACTED: { label: "Contacted", className: "pill-blue" },
  INTERESTED: { label: "Interested", className: "pill-orange" },
  QUOTED: { label: "Quoted", className: "pill-purple" },
  WON: { label: "Won", className: "pill-green" },
  LOST: { label: "Lost", className: "pill-grey" },
  DRAFT: { label: "Draft", className: "pill-grey" },
  PUBLISHED: { label: "Published", className: "pill-green" },
  INACTIVE: { label: "Inactive", className: "pill-grey" },
  SENT: { label: "Sent", className: "pill-blue" },
  ACCEPTED: { label: "Accepted", className: "pill-green" },
  REVISION_REQUESTED: { label: "Revision Requested", className: "pill-orange" },
  DECLINED: { label: "Declined", className: "pill-grey" },
  UNPAID: { label: "Unpaid", className: "pill-orange" },
  PARTIALLY_PAID: { label: "Partially Paid", className: "pill-orange" },
  PAID: { label: "Paid", className: "pill-green" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_MAP[status as Status] ?? { label: status, className: "pill-grey" };
  return <span className={`pill ${config.className}`}>{config.label}</span>;
}
