import { NavLink, Outlet } from "react-router-dom";

const NAV_ITEMS = [
  { label: "Product", href: "/product#product" },
  { label: "How It Works", href: "/product#how-it-works" },
  { label: "Use Cases", href: "/product#use-cases" },
  { label: "About", href: "/about" }
];

const MarketingLayout = () => {
  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="sticky top-0 z-20 border-b border-cloud bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate">Infrasentinel</p>
            <p className="text-lg font-semibold text-ink">Verified Climate Records</p>
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium text-slate">
            {NAV_ITEMS.map((item) =>
              item.href.startsWith("/") && item.href.includes("#") ? (
                <a key={item.label} href={item.href} className="hover:text-ink">
                  {item.label}
                </a>
              ) : (
                <NavLink
                  key={item.label}
                  to={item.href}
                  className={({ isActive }) =>
                    isActive ? "text-ink" : "text-slate hover:text-ink"
                  }
                  end
                >
                  {item.label}
                </NavLink>
              )
            )}
            <a
              href="/product#demo"
              className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"
            >
              Request Demo
            </a>
            <NavLink
              to="/app/dashboard"
              className="rounded-md border border-ink px-4 py-2 text-sm font-semibold text-ink"
            >
              Open App
            </NavLink>
            <NavLink
              to="/login"
              className="rounded-md border border-ink px-4 py-2 text-sm font-semibold text-ink"
            >
              Sign In
            </NavLink>
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="border-t border-cloud bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-slate md:flex-row md:items-center md:justify-between">
          <p>Infrasentinel Compliance Infrastructure</p>
          <p>Enterprise MRV platform for verified climate records.</p>
        </div>
      </footer>
    </div>
  );
};

export default MarketingLayout;
