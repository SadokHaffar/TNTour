'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const router = useRouter();
  const { currentUser, userData, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (currentUser && userData) {
        // User is authenticated, redirect to appropriate dashboard
        const redirectPath = userData.role === 'admin' ? '/admin' : '/dashboard';
        console.log('User authenticated, redirecting to:', redirectPath);
        router.replace(redirectPath);
      } else {
        // User is not authenticated, redirect to login
        console.log('User not authenticated, redirecting to login');
        router.replace('/login');
      }
    }
  }, [currentUser, userData, loading, router]);

  // Show a loading state while checking authentication
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-green-600 border-t-transparent mx-auto mb-4"></div>
        <p className="text-green-600 font-semibold">Loading TNTour...</p>
      </div>
    </div>
  );
}
