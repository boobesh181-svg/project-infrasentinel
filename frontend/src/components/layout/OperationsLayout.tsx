import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  kicker?: string;
  title?: string;
  badges?: string[];
};

const OperationsLayout = ({ children, kicker = "InfraSentinel / Operations", title = "Verification Command Center", badges = ["live incident lane", "websocket synced"] }: Props) => {
  return (
    <div className="operational-shell min-h-screen text-slate-100">
      <div className="border-b border-white/10 bg-slate-950/78 px-4 py-4 operational-glass md:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">{kicker}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-white font-display md:text-xl">{title}</h2>
              {badges.map((badge) => (
                <span key={badge} className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100">
                  {badge}
                </span>
              ))}
            </div>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-slate-300">
              evidence-first operations
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-slate-300">
              high-trust replay
            </div>
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">{children}</main>
    </div>
  );
};

export default OperationsLayout;
