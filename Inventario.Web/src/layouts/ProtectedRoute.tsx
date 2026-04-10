import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useI18n } from "../app/i18n/AppI18nContext";
import { useAuth } from "../auth/AuthContext";

type ProtectedRouteProps = {
  requiredRoles?: string[];
  children?: React.ReactNode;
};

export function ProtectedRoute({ requiredRoles, children }: ProtectedRouteProps) {
  const { t } = useI18n();
  const { isAuthenticated, isLoading, hasAnyRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div style={{ padding: 24 }}>{t("Cargando...", "Loading...")}</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRoles && requiredRoles.length > 0 && !hasAnyRole(requiredRoles)) {
    return <Navigate to="/scan" replace />;
  }

  return <>{children ?? <Outlet />}</>;
}
