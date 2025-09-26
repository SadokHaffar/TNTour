export default function Footer() {
  return (
    <footer className="mt-auto py-6 border-t border-gray-200/50 bg-white/30 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Created by{' '}
            <a 
              href="https://www.haffarmedsadok.me" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-semibold text-blue-600 hover:text-blue-800 transition-colors duration-200 hover:underline"
            >
              Med Sadok Haffar
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}