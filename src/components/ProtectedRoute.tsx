import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-foreground mb-4" size={32} />
        <p className="text-sm text-muted-foreground font-semibold animate-pulse uppercase tracking-widest">
          Carregando Sessão...
        </p>
      </div>
    );
  }

  if (!user) {
    // Redireciona para login e guarda a intenção original de rota
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
