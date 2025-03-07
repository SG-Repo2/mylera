/**
 * Navigation utility functions to help prevent navigation loops and improve navigation flow
 */

import { router } from "expo-router";

// Configuration for navigation debounce timeouts
export const NavigationConfig = {
  // Time to wait before allowing another navigation (ms)
  DEBOUNCE_DELAY: 300,
  // Animation duration for transitions (ms)
  ANIMATION_DURATION: 200,
  // Maximum queue size to prevent unbounded memory growth
  MAX_QUEUE_SIZE: 20
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

/**
 * Helper function to create a promise-based delay
 * @param ms Delay time in milliseconds
 * @returns Promise that resolves after the specified delay
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class NavigationQueue {
  private queue: Array<{ path: string, priority: number, timestamp: number }> = [];
  private processing = false;
  private lastNavTime = 0;
  private navigatorMounted = false;
  private permissionsHandled: boolean = false;
  
  // Set navigator mounted state
  setNavigatorMounted(mounted: boolean) {
    this.navigatorMounted = mounted;
    console.log(`[NavigationQueue] Navigator mounted state set to: ${mounted}`);
    
    // Process queue immediately if navigator is now mounted and there are items in queue
    if (mounted && this.queue.length > 0 && !this.processing) {
      this.processQueue();
    }
  }
  
  // Add permission handling methods
  setPermissionsHandled(handled: boolean) {
    this.permissionsHandled = handled;
  }
  
  isPermissionsHandled() {
    return this.permissionsHandled;
  }
  
  // Add navigation request to queue with priority
  enqueue(path: string, priority = 0) {
    // Don't queue duplicates of the same path
    if (this.queue.some(item => item.path === path)) {
      return;
    }
    
    // Enforce maximum queue size by removing oldest items if necessary
    if (this.queue.length >= NavigationConfig.MAX_QUEUE_SIZE) {
      // Sort by timestamp (oldest first) and remove oldest
      this.queue.sort((a, b) => a.timestamp - b.timestamp);
      this.queue.shift();
      console.log(`[NavigationQueue] Queue limit reached, removed oldest item`);
    }
    
    console.log(`[NavigationQueue] Enqueuing path: ${path} with priority: ${priority}`);
    this.queue.push({ path, priority, timestamp: Date.now() });
    this.queue.sort((a, b) => b.priority - a.priority);
    
    // Only process immediately if navigator is mounted
    if (this.navigatorMounted && !this.processing) {
      this.processQueue();
    } else {
      console.log(`[NavigationQueue] Navigation to ${path} queued. Waiting for navigator to be ready.`);
    }
  }
  
  // Process the navigation queue with adaptive timing
  private async processQueue() {
    if (!this.navigatorMounted) {
      this.processing = false;
      return;
    }
    
    this.processing = true;
    
    // Process all items with a while loop rather than recursion
    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastNav = now - this.lastNavTime;
      
      // Ensure we have adequate delay between navigations
      if (timeSinceLastNav < 500) {
        await delay(500 - timeSinceLastNav);
      }
      
      const next = this.queue.shift();
      if (next) {
        try {
          this.lastNavTime = Date.now();
          await router.replace(next.path);
          console.log(`[NavigationQueue] Navigated to: ${next.path}`);
        } catch (error) {
          console.error(`[NavigationQueue] Navigation error for ${next.path}:`, error);
          // Continue processing queue despite errors
        }
        
        // Small delay between navigation attempts for better UI experience
        await delay(200);
      }
    }
    
    this.processing = false;
  }

  // Process all queued navigation requests
  processAllQueued() {
    console.log('[NavigationQueue] Processing all queued navigation requests');
    
    if (!this.navigatorMounted) {
      console.log('[NavigationQueue] Cannot process queue - navigator not mounted');
      return;
    }
    
    if (this.queue.length > 0 && !this.processing) {
      this.processQueue();
    }
  }
  
  /**
   * Clears all pending navigation requests from the queue
   * @param olderThan Optional parameter to only clear requests older than specified milliseconds
   */
  clearQueue(olderThan?: number) {
    if (olderThan) {
      const now = Date.now();
      const oldSize = this.queue.length;
      this.queue = this.queue.filter(item => (now - item.timestamp) < olderThan);
      console.log(`[NavigationQueue] Cleared ${oldSize - this.queue.length} stale navigation requests older than ${olderThan}ms`);
    } else {
      console.log(`[NavigationQueue] Clearing ${this.queue.length} pending navigation requests`);
      this.queue = [];
    }
  }
}

export const navigationQueue = new NavigationQueue();
