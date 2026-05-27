import {
  LayoutDashboard,
  Radar,
  Scale,
  Shield,
  TestTube
} from "lucide-react";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/app/command-center", label: "Command Center", icon: LayoutDashboard },
  { to: "/app/command-center/live", label: "Live Verification", icon: Radar },
  { to: "/app/command-center/weighbridge/active", label: "Weighbridge Lane", icon: Scale },
  { to: "/app/replay", label: "Audit Replay", icon: Shield }
];

const Sidebar = () => {
  return (
    <aside className="hidden w-[312px] shrink-0 border-r border-white/10 bg-slate-950/85 px-5 py-6 lg:block">
      <div className="mb-8 rounded-[26px] border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-950/70 to-slate-900/60 px-4 py-4 shadow-[0_20px_60px_rgba(2,6,23,0.5)]">
        <div className="flex items-center gap-3">
          <div className="pulse-ring rounded-xl bg-cyan-400/15 p-2">
            <TestTube className="h-5 w-5 text-cyan-200" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.26em] text-slate-500">InfraSentinel</p>
            <p className="text-sm font-semibold text-white font-display">Verification Command Center</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 text-xs text-slate-400">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-emerald-100">
            <span className="h-2 w-2 rounded-full bg-emerald-400 pulse-ring" />
            live ingest stream
          </span>
          <span className="text-[10px] uppercase tracking-[0.22em] text-slate-500">trusted lane</span>
        </div>
      </div>

      <nav className="space-y-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={`${to}-${label}`}
            to={to}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-2xl border px-3 py-3 text-sm transition-all duration-200 ${
                isActive
                  ? "border-cyan-400/30 bg-cyan-500/10 text-white shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_18px_40px_rgba(8,145,178,0.14)]"
                  : "border-white/5 text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-white"
              }`
            }
            end={to === "/app/replay"}
          >
            <Icon className="h-4 w-4 text-cyan-300 transition group-hover:scale-105" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-8 space-y-3 rounded-[24px] border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.22em] text-slate-500">
          <span>mission status</span>
          <span>steady</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">latency</p>
            <p className="mt-2 text-white">Nominal</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">evidence</p>
            <p className="mt-2 text-white">Locked</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
