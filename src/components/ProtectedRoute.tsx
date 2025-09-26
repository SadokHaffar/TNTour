'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'user')[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles = ['admin', 'user'] 
}) => {
  const { currentUser, userData, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!currentUser) {
        router.replace('/login');
        return;
      }

      if (userData && !allowedRoles.includes(userData.role)) {
        router.replace('/unauthorized');
        return;
      }
    }
  }, [currentUser, userData, loading, router, allowedRoles]);

  if (loading || !userData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!currentUser || !allowedRoles.includes(userData.role)) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;