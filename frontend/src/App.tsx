import { Navigate, Route, Routes, useParams } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import AuthLayout from "./layouts/AuthLayout";
import LoginPage from "./pages/LoginPage.tsx";
import { useAuth } from "./hooks/useAuth";
import CommandCenter from "./pages/CommandCenter";
import Timeline from "./pages/Timeline";
import AuditReplay from "./pages/AuditReplay";

const LandingRedirect = () => {
  const { token } = useAuth();
  return <Navigate to={token ? "/app/command-center" : "/login"} replace />;
};

const CommandCenterRedirect = ({ to }: { to: string }) => <Navigate to={to} replace />;

const LegacySiteRedirect = () => {
  const { siteId } = useParams();
  return <Navigate to={siteId ? `/app/command-center/site/${siteId}` : "/app/command-center"} replace />;
};

const LegacyVerificationRedirect = () => {
  const { deliveryId } = useParams();
  return <Navigate to={deliveryId ? `/app/command-center/delivery/${deliveryId}` : "/app/command-center"} replace />;
};

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { token } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingRedirect />} />
      <Route path="/product" element={<LandingRedirect />} />
      <Route path="/about" element={<LandingRedirect />} />

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/app/command-center" replace />} />
        <Route path="command-center" element={<CommandCenter />} />
        <Route path="timeline" element={<Timeline />} />
        <Route path="replay" element={<AuditReplay />} />
        <Route path="*" element={<CommandCenterRedirect to="/app/command-center" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
