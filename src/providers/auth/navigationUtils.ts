import { router } from 'expo-router';
import { navigationQueue } from '@/src/utils/NavigationUtils';

/**
 * Navigate after successful authentication
 */
export function navigateAfterAuth(
  navigatorMounted: boolean,
  route: string = '/(app)/(home)',
  priority: number = 10
) {
  console.log('[navigationUtils] Navigating after auth to:', route);

  if (navigatorMounted) {
    console.log('[navigationUtils] Navigator mounted, proceeding with direct navigation');
    router.replace(route);
    return true;
  } else {
    console.log('[navigationUtils] Navigator not mounted, queueing navigation');
    navigationQueue.enqueue(route, priority);
    return false;
  }
}

/**
 * Create a safety navigation timeout
 * @returns Timeout ID that should be cleared when no longer needed
 */
export function createNavigationSafetyTimeout(
  route: string,
  timeoutMs: number = 2000
): NodeJS.Timeout {
  return setTimeout(() => {
    console.log('[navigationUtils] Forcing navigation due to timeout');
    router.replace(route);
  }, timeoutMs);
}

/**
 * Process any queued navigation requests
 */
export function processQueuedNavigation() {
  console.log('[navigationUtils] Processing queued navigation requests');
  navigationQueue.processAllQueued();
}
