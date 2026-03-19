import {
  Bell,
  Boxes,
  ClipboardList,
  FileCheck,
  FolderKanban,
  LayoutDashboard,
  ShieldAlert,
  Shield,
  SlidersHorizontal,
  TestTube
} from "lucide-react";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/projects", label: "Projects", icon: FolderKanban },
  { to: "/app/material-entries", label: "Material Entries", icon: ClipboardList },
  { to: "/app/evidence", label: "Evidence", icon: FileCheck },
  { to: "/app/risk-center", label: "Risk Center", icon: ShieldAlert },
  { to: "/app/bim-validation", label: "BIM Validation", icon: Boxes },
  { to: "/app/supplier-confirmation", label: "Supplier Confirm", icon: Bell },
  { to: "/app/notifications", label: "Notifications", icon: Bell },
  { to: "/app/audit", label: "Audit Logs", icon: Shield },
  { to: "/app/admin", label: "Admin", icon: SlidersHorizontal }
];

const Sidebar = () => {
  return (
    <aside className="hidden w-[260px] shrink-0 border-r border-slate-800 bg-slate-950 px-4 py-6 lg:block">
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="rounded-md bg-blue-600/20 p-2">
          <TestTube className="h-5 w-5 text-blue-300" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Infrasentinel</p>
          <p className="text-sm font-semibold text-white">Compliance Cloud</p>
        </div>
      </div>

      <nav className="space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={`${to}-${label}`}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-150 ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-900 hover:text-white"
              }`
            }
            end={to === "/app/projects"}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
