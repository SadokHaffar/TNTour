import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle common typos and redirects
  if (pathname.startsWith('/dashbord')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  if (pathname.startsWith('/signin') || pathname.startsWith('/sign-in')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  if (pathname.startsWith('/sign-up') || pathname.startsWith('/register')) {
    return NextResponse.redirect(new URL('/signup', request.url));
  }

  if (pathname.startsWith('/tournament')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Add security headers
  const response = NextResponse.next();
  
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
  
  return response;
}

// Routes Matcher - keeping minimal for future use
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};