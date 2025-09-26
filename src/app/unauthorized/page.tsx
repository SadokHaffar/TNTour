'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';

export default function Unauthorized() {
  const { userData, logout } = useAuth();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50/30 to-red-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -right-20 w-32 h-32 bg-red-200/30 rounded-full blur-xl"></div>
        <div className="absolute -bottom-20 -left-20 w-32 h-32 bg-orange-200/30 rounded-full blur-xl"></div>
      </div>

      <div className={`relative z-10 max-w-xs w-full transition-all duration-700 ${isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95'}`}>
        {/* Main Card */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 overflow-hidden">
          {/* Header */}
          <div className="relative px-4 py-5 text-center">
            {/* Animated Icon */}
            <div className="relative mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center mx-auto shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m0 0v2m0-2h2m-2 0H10m4-6V9a4 4 0 10-8 0v2m8 0h1a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6a2 2 0 012-2h1" />
                </svg>
              </div>
            </div>
            
            {/* Title */}
            <h1 className="text-lg font-black text-gray-900 mb-2">
              Access 
              <span className="bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">Restricted</span>
            </h1>
            
            {/* Description */}
            <p className="text-gray-600 text-xs leading-relaxed mb-3">
              You need proper permissions to access this area.
            </p>

            {/* User Info */}
            {userData && (
              <div className="bg-gray-50 rounded-xl p-2.5 mb-3">
                <div className="text-xs text-gray-700 space-y-1">
                  <div className="flex items-center justify-center space-x-1.5">
                    <span className="w-1.5 h-1.5 bg-orange-400 rounded-full"></span>
                    <span className="font-medium text-xs">{userData.role?.toUpperCase()}</span>
                  </div>
                  <div className="text-gray-600 truncate text-xs">{userData.email}</div>
                </div>
              </div>
            )}

            {/* Tennis Court Divider */}
            <div className="flex items-center justify-center mb-3">
              <div className="flex space-x-1">
                <div className="w-1 h-1 bg-red-400 rounded-full animate-pulse"></div>
                <div className="w-1 h-1 bg-orange-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                <div className="w-1 h-1 bg-red-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="px-4 pb-4 space-y-2">
            <Link
              href="/"
              className="block w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white py-2 rounded-xl font-semibold transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 active:scale-95 text-center text-sm"
            >
              🏠 Back to Home
            </Link>
            
            {userData && (
              <Link
                href={userData.role === 'admin' ? '/admin' : '/dashboard'}
                className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl font-semibold transition-all duration-300 border border-gray-200 hover:border-gray-300 text-center text-sm"
              >
                🎾 Go to Dashboard
              </Link>
            )}
            
            <button
              onClick={handleLogout}
              className="w-full bg-gray-50 hover:bg-gray-100 text-gray-600 py-1.5 rounded-lg font-medium transition-all duration-300 text-xs border border-gray-200"
            >
              🔄 Switch Account
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-2">
          <p className="text-xs text-gray-500">
            Need help? Contact support 💬
          </p>
        </div>
      </div>
    </div>
  );
}