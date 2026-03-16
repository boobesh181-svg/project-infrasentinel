import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const NAV_ITEMS = [
  { label: "Dashboard", to: "/app/dashboard" },
  { label: "Projects", to: "/app/projects" },
  { label: "Notifications", to: "/app/notifications" },
  { label: "Evidence", to: "/app/evidence" },
  { label: "Audit Logs", to: "/app/audit" }
];

const AppLayout = () => {
  const navigate = useNavigate();
  const { token, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-grid">
      <aside className="w-64 bg-white/95 p-6 shadow-soft">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-slate">Infrasentinel</p>
          <h1 className="text-lg font-semibold text-ink">Compliance Console</h1>
        </div>
        <nav className="space-y-2 text-sm">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-lg px-4 py-2 font-medium ${
                  isActive ? "bg-mist text-ink" : "text-slate hover:text-ink"
                }`
              }
              end
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-cloud bg-white/80 px-8 py-4">
          <div>
            <p className="text-sm text-slate">Logged in</p>
            <p className="text-sm font-medium text-ink">{token ? "Active session" : "Guest"}</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-md border border-cloud px-4 py-2 text-sm font-medium text-ink"
          >
            Logout
          </button>
        </header>

        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
