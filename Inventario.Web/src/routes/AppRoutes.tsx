import { Navigate, Route, Routes } from "react-router-dom";
import { ScanPage } from "../features/scan/ScanPage";
import { AssetsPage } from "../features/assets/AssetsPage";
import { InstallationsPage } from "../features/installations/InstallationsPage";
import { AgentsPage } from "../features/agents/AgentsPage";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { ProtectedRoute } from "../layouts/ProtectedRoute";
import { LoginPage } from "../features/auth/LoginPage";
import { AuditPage } from "../features/audit/AuditPage";
import { SessionsPage } from "../features/sessions/SessionsPage";
import { UsersPage } from "../features/users/UsersPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/scan" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route
          path="/scan"
          element={
            <AppShellLayout>
              <ScanPage />
            </AppShellLayout>
          }
        />
        <Route
          path="/assets"
          element={
            <AppShellLayout>
              <AssetsPage />
            </AppShellLayout>
          }
        />
        <Route
          path="/agents"
          element={
            <AppShellLayout>
              <AgentsPage />
            </AppShellLayout>
          }
        />
        <Route
          path="/installations"
          element={
            <AppShellLayout>
              <InstallationsPage />
            </AppShellLayout>
          }
        />
        <Route
          path="/sessions"
          element={
            <AppShellLayout>
              <SessionsPage />
            </AppShellLayout>
          }
        />
      </Route>
      <Route element={<ProtectedRoute requiredRoles={["GlobalAdmin", "TechnicalAdmin"]} />}>
        <Route
          path="/users"
          element={
            <AppShellLayout>
              <UsersPage />
            </AppShellLayout>
          }
        />
      </Route>
      <Route element={<ProtectedRoute requiredRoles={["GlobalAdmin", "Auditor"]} />}>
        <Route
          path="/audit"
          element={
            <AppShellLayout>
              <AuditPage />
            </AppShellLayout>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
