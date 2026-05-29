import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  kicker?: string;
  title?: string;
  badges?: string[];
};

const OperationsLayout = ({ children, kicker = "InfraSentinel / Operations", title = "Verification Command Center", badges = ["live incident lane", "websocket synced"] }: Props) => {
  return (
    <div className="operational-shell enterprise-dense min-h-screen text-slate-100">
      <div className="border-b border-white/10 bg-slate-950/84 px-3 py-3 operational-glass md:px-5 md:py-4">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[9px] uppercase tracking-[0.32em] text-slate-500">{kicker}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
              <h2 className="font-display text-[17px] font-semibold tracking-[-0.03em] text-white md:text-[19px]">{title}</h2>
              {badges.map((badge) => (
                <span key={badge} className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-cyan-100">
                  {badge}
                </span>
              ))}
            </div>
          </div>
          <div className="hidden items-center gap-2.5 md:flex">
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-slate-300">
              evidence-first operations
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-slate-300">
              high-trust replay
            </div>
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-[1440px] px-3 py-3 md:px-5 md:py-4 lg:px-6 lg:py-5">{children}</main>
    </div>
  );
};

export default OperationsLayout;
