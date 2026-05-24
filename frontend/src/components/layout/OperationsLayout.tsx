import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

const OperationsLayout = ({ children }: Props) => {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b bg-white px-6 py-3">
        <div className="max-w-7xl mx-auto text-lg font-semibold">InfraSentinel — Operations Command Center</div>
      </div>
      <main className="max-w-7xl mx-auto p-6">{children}</main>
    </div>
  );
};

export default OperationsLayout;
