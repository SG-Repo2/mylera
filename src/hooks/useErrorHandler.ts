import { useState, useCallback } from 'react';
import { HealthProviderPermissionError } from '@/src/providers/health/types/errors';

interface ErrorHandlerOptions {
  logErrors?: boolean;
  defaultMessage?: string;
}

/**
 * Custom hook for standardized error handling across components
 * 
 * @param options Configuration options for error handling
 * @returns Object containing error state and error handling functions
 */
export const useErrorHandler = (options: ErrorHandlerOptions = {}) => {
  const { 
    logErrors = true,
    defaultMessage = 'An unexpected error occurred. Please try again.'
  } = options;

  const [error, setError] = useState<Error | null>(null);
  const [errorDialogVisible, setErrorDialogVisible] = useState(false);

  /**
   * Get a user-friendly error message based on the error type
   */
  const getUserFriendlyMessage = useCallback((err: Error): string => {
    // Handle permission errors
    if (err instanceof HealthProviderPermissionError) {
      return 'Health data access permission denied. Please grant permissions to continue.';
    }
    
    // Handle network errors
    if (err.message.includes('network') || err.message.includes('timeout')) {
      return 'Network error. Please check your connection and try again.';
    }
    
    // Handle authentication errors
    if (err.message.includes('auth') || err.message.includes('token') || 
        err.message.includes('permission') || err.message.includes('unauthorized')) {
      return 'Authentication error. Please sign in again.';
    }
    
    // Handle database errors
    if (err.message.includes('database') || err.message.includes('PGRST')) {
      return 'Database error. Please try again later.';
    }
    
    // Return the error message if it's user-friendly, otherwise return the default message
    return err.message.length > 10 && !err.message.includes('Error:') ? 
      err.message : defaultMessage;
  }, [defaultMessage]);

  /**
   * Handle an error by setting the error state and showing the error dialog
   */
  const handleError = useCallback((err: unknown) => {
    const errorObject = err instanceof Error ? err : new Error(
      typeof err === 'string' ? err : defaultMessage
    );
    
    if (logErrors) {
      console.error('[ErrorHandler]', errorObject);
    }
    
    setError(errorObject);
    setErrorDialogVisible(true);
    
    return errorObject;
  }, [defaultMessage, logErrors]);

  /**
   * Clear the error state and hide the error dialog
   */
  const clearError = useCallback(() => {
    setError(null);
    setErrorDialogVisible(false);
  }, []);

  /**
   * Dismiss the error dialog without clearing the error state
   */
  const dismissErrorDialog = useCallback(() => {
    setErrorDialogVisible(false);
  }, []);

  return {
    error,
    errorMessage: error ? getUserFriendlyMessage(error) : null,
    errorDialogVisible,
    setErrorDialogVisible,
    handleError,
    clearError,
    dismissErrorDialog,
    getUserFriendlyMessage
  };
};
