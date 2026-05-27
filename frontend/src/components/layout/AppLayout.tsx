import { AnimatePresence, motion } from "framer-motion";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";

const AppLayout = () => {
  const location = useLocation();

  return (
    <div className="operational-shell min-h-screen bg-slate-950 text-slate-100 font-body">
      <div className="operational-grid min-h-screen bg-[linear-gradient(180deg,rgba(2,6,23,0.9),rgba(2,6,23,0.98))]">
        <div className="flex min-h-screen bg-slate-950/45">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <Header />
            <main className="px-4 py-6 md:px-6 lg:px-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -10, filter: "blur(10px)" }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
