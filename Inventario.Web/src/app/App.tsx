import { AppShellLayout } from "../layouts/AppShellLayout";
import { AppRoutes } from "../routes/AppRoutes";

export default function App() {
  return (
    <AppShellLayout>
      <AppRoutes />
    </AppShellLayout>
  );
}
