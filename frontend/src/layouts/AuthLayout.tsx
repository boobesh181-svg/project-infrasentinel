import { Outlet } from "react-router-dom";

const AuthLayout = () => {
  return (
    <div className="operational-shell min-h-screen bg-slate-950 text-slate-100 font-body">
      <div className="operational-grid min-h-screen bg-[linear-gradient(180deg,rgba(2,6,23,0.85),rgba(2,6,23,0.98))]">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-12">
          <div className="w-full max-w-md border border-white/10 bg-slate-950/85 p-8">
          <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
