import { Outlet } from "react-router-dom";

const AuthLayout = () => {
  return (
    <div className="min-h-screen bg-grid">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-2xl bg-white/90 p-8 shadow-panel">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
