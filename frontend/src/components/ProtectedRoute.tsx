import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/stores/auth';

/** Bloqueia rotas autenticadas e, opcionalmente, exige uma permissão. */
export function ProtectedRoute({ permission }: { permission?: string }) {
  const { user, loading, can } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/sign-in" state={{ from: location.pathname }} replace />;
  }

  if (permission && !can(permission)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
}
