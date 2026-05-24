import { ReactNode } from "react";

type BadgeProps = {
  label: string;
  icon?: ReactNode;
};

const statusStyles: Record<string, string> = {
  DRAFT: "border border-slate-700 bg-slate-900/80 text-slate-300",
  SUBMITTED: "border border-cyan-400/20 bg-cyan-500/10 text-cyan-100",
  DETECTED: "border border-cyan-400/20 bg-cyan-500/10 text-cyan-100",
  PROCESSING: "border border-amber-400/20 bg-amber-500/10 text-amber-100",
  VERIFIED: "border border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
  FLAGGED: "border border-rose-400/20 bg-rose-500/10 text-rose-100",
  ESCALATED: "border border-orange-400/20 bg-orange-500/10 text-orange-100",
  RESOLVED: "border border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
  ARCHIVED: "border border-slate-500/20 bg-slate-800/90 text-slate-100",
  APPROVED: "border border-green-400/20 bg-green-500/10 text-green-100",
  LOCKED: "border border-slate-500/20 bg-slate-800/90 text-slate-100",
  NONE: "border border-amber-400/20 bg-amber-500/10 text-amber-100",
  ACKNOWLEDGED: "border border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
  DISPUTED: "border border-rose-400/20 bg-rose-500/10 text-rose-100",
  LOW: "border border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
  MEDIUM: "border border-orange-400/20 bg-orange-500/10 text-orange-100",
  HIGH: "border border-rose-400/20 bg-rose-500/10 text-rose-100"
};

const Badge = ({ label, icon }: BadgeProps) => {
  const normalized = label.toUpperCase();

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusStyles[normalized] ?? "border border-white/10 bg-white/5 text-slate-300"}`}
    >
      {icon}
      {normalized}
    </span>
  );
};

export default Badge;
