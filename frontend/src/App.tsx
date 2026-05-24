import { Navigate, Route, Routes, useParams } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import AuthLayout from "./layouts/AuthLayout";
import AuditPage from "./pages/AuditPage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import { useAuth } from "./hooks/useAuth";
import OpsOverviewPage from "./pages/OpsOverviewPage";
import SitePage from "./pages/SitePage";
import VerificationPage from "./pages/VerificationPage";

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
        <Route path="command-center" element={<OpsOverviewPage />} />
        <Route path="command-center/site/:siteId" element={<SitePage />} />
        <Route path="command-center/delivery/:deliveryId" element={<VerificationPage />} />
        <Route path="replay" element={<AuditPage />} />

        <Route path="dashboard" element={<CommandCenterRedirect to="/app/command-center" />} />
        <Route path="projects" element={<CommandCenterRedirect to="/app/command-center" />} />
        <Route path="material-entries" element={<CommandCenterRedirect to="/app/command-center" />} />
        <Route path="projects/:projectId" element={<CommandCenterRedirect to="/app/command-center" />} />
        <Route path="projects/:projectId/bim" element={<CommandCenterRedirect to="/app/command-center" />} />
        <Route path="projects/:projectId/material-entries/new" element={<CommandCenterRedirect to="/app/command-center" />} />
        <Route path="material-entries/:entryId" element={<CommandCenterRedirect to="/app/command-center" />} />
        <Route path="material-entries/:entryId/acknowledgements" element={<CommandCenterRedirect to="/app/command-center" />} />
        <Route path="evidence" element={<CommandCenterRedirect to="/app/command-center" />} />
        <Route path="material-entries/:entryId/evidence" element={<CommandCenterRedirect to="/app/command-center" />} />
        <Route path="supplier-confirmation" element={<CommandCenterRedirect to="/app/command-center" />} />
        <Route path="risk-center" element={<CommandCenterRedirect to="/app/command-center" />} />
        <Route path="bim-validation" element={<CommandCenterRedirect to="/app/command-center" />} />
        <Route path="notifications" element={<CommandCenterRedirect to="/app/command-center" />} />
        <Route path="audit" element={<Navigate to="/app/replay" replace />} />
        <Route path="ops" element={<Navigate to="/app/command-center" replace />} />
        <Route path="ops/site/:siteId" element={<LegacySiteRedirect />} />
        <Route path="verify/:deliveryId" element={<LegacyVerificationRedirect />} />
        <Route path="admin" element={<CommandCenterRedirect to="/app/command-center" />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
