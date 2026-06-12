import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground text-xs uppercase tracking-[0.3em]">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}
