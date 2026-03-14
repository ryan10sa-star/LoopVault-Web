import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';

const BYPASS_SUBSCRIPTION = import.meta.env.VITE_BYPASS_SUBSCRIPTION === 'true';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps): JSX.Element {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <p className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-sm text-slate-200">Checking session…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate replace to="/login" />;
  }

  if (!BYPASS_SUBSCRIPTION && profile !== null && !profile.subscription_active) {
    return <Navigate replace to="/subscribe" />;
  }

  return <>{children}</>;
}
