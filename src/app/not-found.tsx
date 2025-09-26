'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function NotFound() {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleGoHome = () => {
    router.push('/');
  };

  const handleGoBack = () => {
    router.back();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-yellow-50/30 to-green-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -right-20 w-32 h-32 bg-green-200/30 rounded-full blur-xl"></div>
        <div className="absolute -bottom-20 -left-20 w-32 h-32 bg-yellow-200/30 rounded-full blur-xl"></div>
      </div>

      {/* Floating Tennis Elements - Mobile Friendly */}
      <div className="absolute inset-0 pointer-events-none hidden sm:block">
        <div className="absolute top-20 left-20 text-2xl opacity-20 animate-bounce">🎾</div>
        <div className="absolute top-32 right-20 text-xl opacity-25 animate-bounce" style={{animationDelay: '1s'}}>🏆</div>
        <div className="absolute bottom-32 left-1/4 text-2xl opacity-20 animate-bounce" style={{animationDelay: '2s'}}>⚡</div>
      </div>

      {/* Main Content */}
      <div className={`relative z-10 max-w-md w-full transition-all duration-700 ${isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95'}`}>
        {/* Main Card */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 overflow-hidden">
          {/* Header */}
          <div className="relative px-6 py-8 text-center">
            {/* 404 Badge */}
            <div className="relative mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto shadow-xl">
                <span className="text-2xl font-black text-white">404</span>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-400 rounded-full flex items-center justify-center animate-pulse">
                  <span className="text-white text-xs">!</span>
                </div>
              </div>
            </div>
            
            {/* Title */}
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 leading-tight mb-3">
              <span className="block">Oops!</span>
              <span className="bg-gradient-to-r from-green-600 via-green-500 to-yellow-500 bg-clip-text text-transparent">
                Out of Bounds
              </span>
            </h1>
            
            {/* Description */}
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              The page you're looking for has served an ace... right out of our website! 🎾
            </p>

            {/* Mini Tennis Court */}
            <div className="bg-gradient-to-br from-green-400 to-green-500 rounded-2xl p-4 mb-6 shadow-lg">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-6 h-6 bg-yellow-400 rounded-full animate-bounce"></div>
                <div className="text-white text-xs font-bold">NET</div>
                <div className="text-lg animate-pulse">🎾</div>
              </div>
              <div className="text-xs text-white/80 mt-2">Ball went out!</div>
            </div>

            {/* Fun Fact */}
            <div className="bg-gray-50 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <span className="text-sm">🎾</span>
                <span className="text-xs font-bold text-gray-700">Did You Know?</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                The fastest tennis serve was <strong>263.4 km/h</strong>! That's faster than this page disappeared.
              </p>
            </div>
          </div>
          
          {/* Actions */}
          <div className="px-6 pb-8 space-y-3">
            <button
              onClick={handleGoHome}
              className="w-full bg-gradient-to-r from-green-500 via-green-600 to-yellow-500 hover:from-green-600 hover:via-green-700 hover:to-yellow-600 text-white py-3 rounded-2xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 flex items-center justify-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Back to Home Court</span>
            </button>
            <button
              onClick={handleGoBack}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-2xl font-semibold transition-all duration-300 border border-gray-200 hover:border-gray-300 flex items-center justify-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Previous Rally</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-4">
          <p className="text-xs text-gray-500">
            Need help? Contact support! �
          </p>
        </div>
      </div>

      {/* Mobile-friendly floating hint */}
      <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur-md rounded-full w-6 h-6 flex items-center justify-center shadow-md animate-bounce">
        <div className="text-xs">👆</div>
      </div>
    </div>
  );
}