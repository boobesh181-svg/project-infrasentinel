import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import AuthLayout from "./layouts/AuthLayout";
import MarketingLayout from "./layouts/MarketingLayout";
import AboutPage from "./pages/AboutPage.tsx";
import AuditPage from "./pages/AuditPage.tsx";
import BimValidationPage from "./pages/BimValidationPage.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";
import EntryAcknowledgementsPage from "./pages/EntryAcknowledgementsPage.tsx";
import HomePage from "./pages/HomePage.tsx";
import EvidenceIndexPage from "./pages/EvidenceIndexPage.tsx";
import EvidencePage from "./pages/EvidencePage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import MaterialEntryPage from "./pages/MaterialEntryPage.tsx";
import NotificationsPage from "./pages/NotificationsPage.tsx";
import ProjectDetailPage from "./pages/ProjectDetailPage.tsx";
import ProjectBIMPage from "./pages/ProjectBIMPage.tsx";
import ProjectsPage from "./pages/ProjectsPage.tsx";
import RiskCenterPage from "./pages/RiskCenterPage.tsx";
import SupplierConfirmationPage from "./pages/SupplierConfirmationPage.tsx";
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
        <Route path="material-entries" element={<ProjectsPage />} />
        <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="projects/:projectId/bim" element={<ProjectBIMPage />} />
        <Route
          path="projects/:projectId/material-entries/new"
          element={<MaterialEntryPage mode="create" />}
        />
        <Route path="material-entries/:entryId" element={<MaterialEntryPage mode="view" />} />
        <Route path="material-entries/:entryId/acknowledgements" element={<EntryAcknowledgementsPage />} />
        <Route path="evidence" element={<EvidenceIndexPage />} />
        <Route path="material-entries/:entryId/evidence" element={<EvidencePage />} />
        <Route path="supplier-confirmation" element={<SupplierConfirmationPage />} />
        <Route path="risk-center" element={<RiskCenterPage />} />
        <Route path="bim-validation" element={<BimValidationPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="admin" element={<DashboardPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
