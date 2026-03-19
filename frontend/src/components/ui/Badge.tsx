import { ReactNode } from "react";

type BadgeProps = {
  label: string;
  icon?: ReactNode;
};

const statusStyles: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  VERIFIED: "bg-green-100 text-green-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  LOCKED: "bg-slate-200 text-slate-800",
  NONE: "bg-amber-100 text-amber-700",
  ACKNOWLEDGED: "bg-green-100 text-green-700",
  DISPUTED: "bg-red-100 text-red-700",
  LOW: "bg-emerald-100 text-emerald-700",
  MEDIUM: "bg-orange-100 text-orange-700",
  HIGH: "bg-red-100 text-red-700"
};

const Badge = ({ label, icon }: BadgeProps) => {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[label] ?? "bg-slate-100 text-slate-700"}`}
    >
      {icon}
      {label}
    </span>
  );
};

export default Badge;
