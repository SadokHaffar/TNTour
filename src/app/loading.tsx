'use client';

export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-yellow-50/50 to-green-100 flex items-center justify-center relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-green-200 to-yellow-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-yellow-200 to-green-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-br from-green-300 to-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-50 animate-blob animation-delay-4000"></div>
      </div>

      {/* Main Loading Content */}
      <div className="relative z-10 text-center">
        {/* Animated Tennis Ball */}
        <div className="relative mb-8">
          <div className="w-24 h-24 mx-auto">
            {/* Tennis Ball Container */}
            <div className="relative w-full h-full">
              {/* Ball Shadow */}
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-4 bg-gray-300 rounded-full opacity-30 animate-pulse"></div>
              
              {/* Tennis Ball */}
              <div className="relative w-20 h-20 mx-auto bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-500 rounded-full animate-bounce shadow-2xl">
                {/* Ball Lines */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-0.5 bg-white rounded-full opacity-80"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-0.5 h-16 bg-white rounded-full opacity-60"></div>
                </div>
                
                {/* Ball Highlight */}
                <div className="absolute top-2 left-2 w-6 h-6 bg-yellow-200 rounded-full opacity-60"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Text */}
        <div className="mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            <span className="bg-gradient-to-r from-green-600 via-green-500 to-yellow-500 bg-clip-text text-transparent">
              Preparing the Court
            </span>
          </h2>
          <p className="text-lg text-gray-600 mb-6">
            Getting everything ready for your tournament experience...
          </p>
        </div>

        {/* Animated Progress Bar */}
        <div className="relative w-64 mx-auto mb-8">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
            <div className="h-full bg-gradient-to-r from-green-400 via-green-500 to-yellow-400 rounded-full animate-pulse transform transition-all duration-1000 w-3/4"></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>Loading</span>
            <span>75%</span>
          </div>
        </div>

        {/* Loading Steps */}
        <div className="flex justify-center space-x-8 mb-8">
          <div className="flex items-center space-x-2 text-green-600">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Authentication</span>
          </div>
          <div className="flex items-center space-x-2 text-yellow-600">
            <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
            <span className="text-sm font-medium">Tournaments</span>
          </div>
          <div className="flex items-center space-x-2 text-gray-400">
            <div className="w-3 h-3 bg-gray-300 rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
            <span className="text-sm font-medium">Ready!</span>
          </div>
        </div>

        {/* Floating Elements */}
        <div className="flex justify-center space-x-6 opacity-60">
          <div className="text-2xl animate-bounce" style={{animationDelay: '0s'}}>🎾</div>
          <div className="text-2xl animate-bounce" style={{animationDelay: '0.5s'}}>🏆</div>
          <div className="text-2xl animate-bounce" style={{animationDelay: '1s'}}>⚡</div>
        </div>

        {/* Loading Message */}
        <div className="mt-8">
          <p className="text-sm text-gray-500">
            Almost there... preparing your personalized tennis experience! 🚀
          </p>
        </div>
      </div>

      {/* Corner Decorations */}
      <div className="absolute top-8 left-8 text-4xl opacity-20 animate-spin" style={{animationDuration: '10s'}}>🎯</div>
      <div className="absolute top-8 right-8 text-3xl opacity-30 animate-pulse">💫</div>
      <div className="absolute bottom-8 left-8 text-3xl opacity-25 animate-bounce">🔥</div>
      <div className="absolute bottom-8 right-8 text-4xl opacity-20 animate-spin" style={{animationDuration: '15s', animationDirection: 'reverse'}}>⭐</div>
    </div>
  );
}