import { Navigate, Route, Routes } from "react-router-dom";
import { ScanPage } from "../features/scan/ScanPage";
import { AssetsPage } from "../features/assets/AssetsPage";
import { InstallationsPage } from "../features/installations/InstallationsPage";
import { AgentsPage } from "../features/agents/AgentsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/scan" replace />} />
      <Route path="/scan" element={<ScanPage />} />
      <Route path="/assets" element={<AssetsPage />} />
      <Route path="/installations" element={<InstallationsPage />} />
      <Route path="/agents" element={<AgentsPage />} />
      <Route path="*" element={<Navigate to="/scan" replace />} />
    </Routes>
  );
}
