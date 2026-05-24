import { LogOut, Search } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import Button from "../ui/Button";

const titleMap: Record<string, string> = {
  "/app/command-center/site": "Site Queue",
  "/app/command-center/delivery": "Delivery Review",
  "/app/command-center": "Command Center",
  "/app/replay": "Audit Replay"
};

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const pageTitle =
    Object.entries(titleMap).find(([prefix]) => location.pathname.startsWith(prefix))?.[1] ??
    "Infrasentinel";

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 px-4 py-4 backdrop-blur operational-glass md:px-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.26em] text-slate-400">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-100">
              <span className="h-2 w-2 rounded-full bg-emerald-400 pulse-ring" />
              live operations
            </span>
            <span>real-time verification</span>
            <span>latency nominal</span>
          </div>
          <h1 className="text-[25px] font-semibold tracking-[-0.02em] text-white md:text-[30px]">{pageTitle}</h1>
          <p className="text-sm text-slate-400">Real-time infrastructure verification, evidence linkage, and incident replay</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 md:flex">
            <Search className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-300">Stream search</span>
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
