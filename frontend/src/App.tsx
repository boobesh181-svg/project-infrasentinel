import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import AuthLayout from "./layouts/AuthLayout";
import MarketingLayout from "./layouts/MarketingLayout";
import AuditLogsPage from "./pages/AuditLogsPage";
import AuditIndexPage from "./pages/AuditIndexPage";
import AboutPage from "./pages/AboutPage";
import DashboardPage from "./pages/DashboardPage";
import HomePage from "./pages/HomePage";
import EvidenceIndexPage from "./pages/EvidenceIndexPage";
import EvidencePage from "./pages/EvidencePage";
import LoginPage from "./pages/LoginPage";
import MaterialEntryPage from "./pages/MaterialEntryPage";
import NotificationsPage from "./pages/NotificationsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import ProjectsPage from "./pages/ProjectsPage";
import { useAuth } from "./hooks/useAuth";

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
      <Route element={<MarketingLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/product" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
      </Route>

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
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        <Route
          path="projects/:projectId/material-entries/new"
          element={<MaterialEntryPage mode="create" />}
        />
        <Route path="material-entries/:entryId" element={<MaterialEntryPage mode="view" />} />
        <Route path="evidence" element={<EvidenceIndexPage />} />
        <Route path="material-entries/:entryId/evidence" element={<EvidencePage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="audit" element={<AuditIndexPage />} />
        <Route path="audit/:entityType/:entityId" element={<AuditLogsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
