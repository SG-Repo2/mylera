/**
 * Navigation utility functions to help prevent navigation loops and improve navigation flow
 */

// Configuration for navigation debounce timeouts
export const NavigationConfig = {
  // Time to wait before allowing another navigation (ms)
  DEBOUNCE_DELAY: 300,
  // Animation duration for transitions (ms)
  ANIMATION_DURATION: 200
};

/**
 * Determines if a URL is a protected route that requires authentication
 * @param pathname Current path/URL
 * @returns Boolean indicating if the route requires authentication
 */
export function isProtectedRoute(pathname: string): boolean {
  // Routes that require authentication
  const protectedPaths = [
    '/(app)', // All app routes
    '/profile',
    '/settings'
  ];
  
  return protectedPaths.some(path => pathname === path || pathname.startsWith(path));
}

/**
 * Determines if a URL is an authentication route
 * @param pathname Current path/URL
 * @returns Boolean indicating if the route is an auth route
 */
export function isAuthRoute(pathname: string): boolean {
  // Routes related to authentication
  const authPaths = [
    '/(auth)',
    '/login',
    '/signup',
    '/forgot-password'
  ];
  
  return authPaths.some(path => pathname === path || pathname.startsWith(path));
}

/**
 * Determines if a URL is a public route that doesn't require authentication
 * @param pathname Current path/URL
 * @returns Boolean indicating if the route is public
 */
export function isPublicRoute(pathname: string): boolean {
  // Routes that don't require authentication
  const publicPaths = [
    '/privacy',
    '/terms',
    '/about',
    '/(marketing)'
  ];
  
  return publicPaths.some(path => pathname === path || pathname.startsWith(path));
}
