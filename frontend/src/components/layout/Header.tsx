import { LogOut, Search } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import Button from "../ui/Button";

const titleMap: Record<string, string> = {
  "/app/dashboard": "Dashboard",
  "/app/projects": "Projects",
  "/app/evidence": "Evidence",
  "/app/notifications": "Notifications",
  "/app/audit": "Audit Logs",
  "/app/admin": "Admin"
};

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const pageTitle =
    Object.entries(titleMap).find(([prefix]) => location.pathname.startsWith(prefix))?.[1] ??
    "Infrasentinel";

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-slate-900">{pageTitle}</h1>
          <p className="text-sm text-slate-500">Enterprise emissions and compliance operations</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 md:flex">
            <Search className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-400">Quick search</span>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <LogOut className="mr-2 inline h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
