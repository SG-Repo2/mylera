import { useCallback } from 'react';
import { router } from 'expo-router';
import { navigationQueue } from '@/src/utils/NavigationUtils';
import { useNavigationReady } from '@/src/contexts/NavigationReadyContext';

/**
 * This hook provides navigation utilities for auth-related flows.
 * It separates the navigation logic from authentication business logic,
 * making the code more maintainable and focused.
 */
export function useAuthNavigation() {
  const { isReady: navigatorMounted } = useNavigationReady();

  /**
   * Navigate to a specific route with safety checks 
   * and fallback to queue if navigator is not ready
   */
  const navigateSafely = useCallback((path: string, priority = 0) => {
    console.log(`[useAuthNavigation] Attempting to navigate to ${path}`);

    // Force navigation after 5 seconds regardless of navigator state
    // This prevents app from getting stuck if the navigator mount detection fails
    const timeSinceAppStart = Date.now() - (global.appStartTime || Date.now());
    const forceNavigationAfterTimeout = timeSinceAppStart > 5000;
    
    // Wait for navigator to be mounted, unless we're forcing navigation
    if (!navigatorMounted && !forceNavigationAfterTimeout) {
      console.log('[useAuthNavigation] Navigator not mounted, queueing navigation to', path);
      
      // Add to navigation queue with priority
      navigationQueue.enqueue(path, priority);
      return;
    }
    
    if (forceNavigationAfterTimeout && !navigatorMounted) {
      console.warn('[useAuthNavigation] Forcing navigation despite navigator not being mounted - timeout reached');
    }
    
    // Direct navigation when navigator is ready
    console.log('[useAuthNavigation] Navigator ready, navigating to', path);
    router.replace(path);
  }, [navigatorMounted]);

  /**
   * Navigate to the home page
   */
  const navigateToHome = useCallback((priority = 0) => {
    navigateSafely('/(app)/(home)', priority);
  }, [navigateSafely]);

  /**
   * Navigate to the login page
   */
  const navigateToLogin = useCallback((priority = 0) => {
    navigateSafely('/(auth)/login', priority);
  }, [navigateSafely]);

  /**
   * Navigate to the registration page
   */
  const navigateToRegister = useCallback((priority = 0) => {
    navigateSafely('/(auth)/register', priority);
  }, [navigateSafely]);

  /**
   * Navigate to the forgot password page
   */
  const navigateToForgotPassword = useCallback((priority = 0) => {
    navigateSafely('/forgot-password', priority);
  }, [navigateSafely]);

  /**
   * Process any queued navigation
   */
  const processQueuedNavigation = useCallback(() => {
    if (navigatorMounted) {
      console.log('[useAuthNavigation] Processing queued navigation');
      navigationQueue.processAllQueued();
    }
  }, [navigatorMounted]);

  return {
    navigateSafely,
    navigateToHome,
    navigateToLogin,
    navigateToRegister,
    navigateToForgotPassword,
    processQueuedNavigation,
    isNavigatorMounted: navigatorMounted,
  };
} 