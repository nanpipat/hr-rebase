interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "danger" | "warning" | "info" | "neutral";
}

const variants = {
  success: "bg-green-100 text-green-800",
  danger: "bg-red-100 text-red-800",
  warning: "bg-yellow-100 text-yellow-800",
  info: "bg-blue-100 text-blue-700",
  neutral: "bg-gray-100 text-gray-800",
};

export default function Badge({ children, variant = "neutral" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}
    >
      {children}
    </span>
  );
}

export function statusVariant(
  status: string
): "success" | "danger" | "warning" | "info" | "neutral" {
  switch (status) {
    case "Active":
    case "Approved":
    case "Present":
      return "success";
    case "Absent":
    case "Rejected":
    case "Cancelled":
    case "Disabled":
      return "danger";
    case "Open":
    case "Pending":
    case "On Leave":
      return "warning";
    case "Left":
    case "Suspended":
      return "neutral";
    default:
      return "neutral";
  }
}
