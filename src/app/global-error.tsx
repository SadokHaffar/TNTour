'use client';

import { useEffect, useState } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    console.error('Global error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50/30 to-red-100 relative overflow-hidden flex items-center justify-center">
          {/* Animated Background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-red-200 to-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
            <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-orange-200 to-red-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          </div>

          {/* Main Content */}
          <div className={`relative z-10 text-center px-4 max-w-4xl mx-auto transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            {/* Error Icon */}
            <div className="mb-8">
              <div className="relative bg-white/90 backdrop-blur-xl border-2 border-red-200 rounded-full w-32 h-32 mx-auto flex items-center justify-center shadow-2xl">
                <div className="text-6xl animate-bounce">⚠️</div>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-6xl font-black text-gray-900 leading-tight mb-6">
              <span className="block">Game Set Match</span>
              <span className="bg-gradient-to-r from-red-600 via-red-500 to-orange-500 bg-clip-text text-transparent">
                Technical Fault!
              </span>
            </h1>

            {/* Description */}
            <div className="mb-12">
              <p className="text-xl text-gray-700 leading-relaxed mb-6">
                Looks like our serve hit the net! Something unexpected happened on the court. 🎾
              </p>
              <p className="text-lg text-gray-600">
                Don't worry, even champions face challenges. Let's get you back in the game!
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-8">
              <button
                onClick={reset}
                className="group bg-gradient-to-r from-red-500 via-red-600 to-orange-500 hover:from-red-600 hover:via-red-700 hover:to-orange-600 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center space-x-3"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Try Again</span>
              </button>

              <button
                onClick={() => window.location.href = '/'}
                className="bg-white/80 backdrop-blur-md hover:bg-white text-gray-700 hover:text-gray-900 px-8 py-4 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center space-x-3 border-2 border-gray-200 hover:border-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>Home Court</span>
              </button>
            </div>

            {/* Technical Details (collapsible) */}
            <details className="bg-white/70 backdrop-blur-lg rounded-2xl p-6 shadow-xl border border-white/50 text-left">
              <summary className="cursor-pointer font-bold text-gray-800 mb-4 flex items-center space-x-2">
                <span>🔧</span>
                <span>Technical Details (For Developers)</span>
              </summary>
              <div className="bg-gray-100 rounded-lg p-4 font-mono text-sm text-gray-700 overflow-auto">
                <p><strong>Error:</strong> {error.message}</p>
                {error.digest && <p><strong>Digest:</strong> {error.digest}</p>}
                <p><strong>Stack:</strong></p>
                <pre className="whitespace-pre-wrap text-xs mt-2">{error.stack}</pre>
              </div>
            </details>
          </div>
        </div>
      </body>
    </html>
  );
}