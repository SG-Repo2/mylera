/**
 * Navigation utility functions to help prevent navigation loops and improve navigation flow
 */

import { router } from "expo-router";

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

export class NavigationQueue {
  private queue: Array<{ path: string, priority: number }> = [];
  private processing = false;
  private lastNavTime = 0;
  
  // Add navigation request to queue with priority
  enqueue(path: string, priority = 0) {
    // Don't queue duplicates of the same path
    if (this.queue.some(item => item.path === path)) {
      return;
    }
    
    this.queue.push({ path, priority });
    this.queue.sort((a, b) => b.priority - a.priority);
    
    if (!this.processing) {
      this.processQueue();
    }
  }
  
  // Process the navigation queue with adaptive timing
  private async processQueue() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }
    
    this.processing = true;
    const now = Date.now();
    const timeSinceLastNav = now - this.lastNavTime;
    
    // Adaptive delay based on how recently we navigated
    const delay = timeSinceLastNav < 500 ? 500 : 0;
    
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    const next = this.queue.shift();
    if (next) {
      try {
        this.lastNavTime = Date.now();
        await router.replace(next.path);
        console.log(`[NavigationQueue] Navigated to: ${next.path}`);
      } catch (error) {
        console.error(`[NavigationQueue] Navigation error:`, error);
      }
    }
    
    // Continue processing the queue with a small delay between navigations
    setTimeout(() => this.processQueue(), 100);
  }
}

export const navigationQueue = new NavigationQueue();
