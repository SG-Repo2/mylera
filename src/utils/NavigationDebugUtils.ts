import { Platform } from 'react-native';

/**
 * Utility functions for debugging navigation issues
 */
const isDebugMode = __DEV__;
const navigationDebugEnabled = true;

/**
 * Log navigation related events for debugging
 * @param message The message to log
 * @param data Optional data to include in the log
 */
export function logNavigation(message: string, data?: any): void {
  if (isDebugMode && navigationDebugEnabled) {
    console.log(`[Navigation${Platform.OS === 'android' ? '-Android' : ''}] ${message}`, data || '');
  }
}

/**
 * Monitor navigation state changes for debugging
 * @param prevPath Previous path
 * @param currentPath Current path
 */
export function trackNavigationChange(prevPath: string | null, currentPath: string): void {
  if (isDebugMode && navigationDebugEnabled && prevPath !== currentPath) {
    console.log(`[Navigation] Route changed: ${prevPath || 'null'} → ${currentPath}`);
  }
}

/**
 * Track navigation timing for performance debugging
 */
export class NavigationTimer {
  private static timers: Record<string, number> = {};

  /**
   * Start timing a navigation operation
   * @param id Unique identifier for the navigation operation
   */
  static start(id: string): void {
    if (isDebugMode && navigationDebugEnabled) {
      this.timers[id] = Date.now();
    }
  }

  /**
   * End timing a navigation operation and log the result
   * @param id Unique identifier for the navigation operation
   * @param description Description of the navigation operation
   */
  static end(id: string, description: string): void {
    if (isDebugMode && navigationDebugEnabled && this.timers[id]) {
      const duration = Date.now() - this.timers[id];
      console.log(`[Navigation] ${description} took ${duration}ms`);
      delete this.timers[id];
    }
  }
}

/**
 * Utility for debugging navigation props and options
 * @param props Navigation props to debug
 */
export function debugNavigationProps(props: any): void {
  if (isDebugMode && navigationDebugEnabled) {
    console.log('[Navigation] Props:', {
      routeName: props?.route?.name,
      params: props?.route?.params,
      key: props?.route?.key,
      platform: Platform.OS
    });
  }
}
