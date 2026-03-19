import { NavLink, Outlet } from "react-router-dom";

const NAV_ITEMS = [
  { label: "Platform", href: "/product#product" },
  { label: "Workflow", href: "/product#how-it-works" },
  { label: "Demo", href: "/product#demo" },
  { label: "About", href: "/about" }
];

const MarketingLayout = () => {
  return (
    <div className="min-h-screen bg-[#04070f] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#04070f]/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#88a7d2]">Infrasentinel</p>
            <p className="font-display text-lg font-semibold text-white">Verified Climate Records</p>
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium text-[#a6bce0]">
            {NAV_ITEMS.map((item) =>
              item.href.startsWith("/") && item.href.includes("#") ? (
                <a key={item.label} href={item.href} className="hover:text-white">
                  {item.label}
                </a>
              ) : (
                <NavLink
                  key={item.label}
                  to={item.href}
                  className={({ isActive }) =>
                    isActive ? "text-white" : "text-[#a6bce0] hover:text-white"
                  }
                  end
                >
                  {item.label}
                </NavLink>
              )
            )}
            <a
              href="/product#demo"
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#09162e]"
            >
              Request Demo
            </a>
            <NavLink
              to="/app/dashboard"
              className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white"
            >
              Open App
            </NavLink>
            <NavLink
              to="/login"
              className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white"
            >
              Sign In
            </NavLink>
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="border-t border-white/10 bg-[#04070f]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-[#8eaad3] md:flex-row md:items-center md:justify-between">
          <p>Infrasentinel Compliance Infrastructure</p>
          <p>Enterprise MRV platform for verified climate records.</p>
        </div>
      </footer>
    </div>
  );
};

export default MarketingLayout;
