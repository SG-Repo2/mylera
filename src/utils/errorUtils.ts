import type { HealthPlatform } from '../providers/health/factory/HealthProviderFactory';

/**
 * Error categories for better error handling and user experience
 */
export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NETWORK = 'network',
  VALIDATION = 'validation',
  HEALTH_PERMISSION = 'health_permission',
  HEALTH_DATA = 'health_data',
  UNKNOWN = 'unknown'
}

/**
 * Standard error interface to ensure consistent error objects
 */
export interface StandardError {
  message: string;     // User-friendly message
  category: ErrorCategory;
  originalError?: unknown;
  code?: string;       // Optional error code for specific handling
}

/**
 * Convert any error to a standardized error object
 */
export function standardizeError(error: unknown): StandardError {
  // If it's already a StandardError, return it
  if (typeof error === 'object' && error !== null && 'category' in error && 'message' in error) {
    return error as StandardError;
  }

  if (error instanceof Error) {
    const errorMessage = error.message;
    
    // Authentication errors
    if (errorMessage.includes('Invalid login credentials') || 
        errorMessage.includes('Email not confirmed') ||
        errorMessage.includes('Invalid email or password')) {
      return {
        message: 'Invalid email or password. Please try again.',
        category: ErrorCategory.AUTHENTICATION,
        originalError: error
      };
    }
    
    // Authorization errors
    if (errorMessage.includes('42501') || errorMessage.includes('permission denied')) {
      return {
        message: 'You don\'t have permission to perform this action.',
        category: ErrorCategory.AUTHORIZATION,
        originalError: error,
        code: '42501'
      };
    }
    
    // Network errors
    if (errorMessage.includes('network') || 
        errorMessage.includes('timeout') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('PGRST200')) {
      return {
        message: 'Network error. Please check your connection and try again.',
        category: ErrorCategory.NETWORK,
        originalError: error
      };
    }
    
    // Validation errors
    if (errorMessage.includes('valid') || 
        errorMessage.includes('required') || 
        errorMessage.includes('format')) {
      return {
        message: errorMessage, // Keep original message for validation errors
        category: ErrorCategory.VALIDATION,
        originalError: error
      };
    }
    
    // Health permission errors
    if (errorMessage.includes('HealthKit') || 
        errorMessage.includes('HealthConnect') ||
        errorMessage.includes('health permission')) {
      return {
        message: 'Health services need appropriate permissions. Please check your settings.',
        category: ErrorCategory.HEALTH_PERMISSION,
        originalError: error
      };
    }
    
    // Health data errors
    if (errorMessage.includes('health data') || 
        errorMessage.includes('metrics') ||
        errorMessage.includes('READ_')) {
      return {
        message: 'Unable to access health data. Please check your permissions.',
        category: ErrorCategory.HEALTH_DATA,
        originalError: error
      };
    }
    
    // Default error handling
    return {
      message: errorMessage,
      category: ErrorCategory.UNKNOWN,
      originalError: error
    };
  }
  
  // For non-Error objects
  return {
    message: 'An unexpected error occurred.',
    category: ErrorCategory.UNKNOWN,
    originalError: error
  };
}

/**
 * Map authentication errors to user-friendly messages
 * @deprecated Use standardizeError instead for more comprehensive error handling
 */
export function mapAuthError(err: unknown): string {
  console.warn('mapAuthError is deprecated. Use standardizeError instead.');
  return standardizeError(err).message;
}

/**
 * Map platform-specific health provider errors to user-friendly messages
 * @deprecated Use standardizeError instead for more comprehensive error handling
 */
export function mapHealthProviderError(err: unknown, platform: HealthPlatform): string {
  console.warn('mapHealthProviderError is deprecated. Use standardizeError instead.');
  
  const standardError = standardizeError(err);
  
  // Add platform-specific handling
  if (standardError.category === ErrorCategory.HEALTH_PERMISSION ||
      standardError.category === ErrorCategory.HEALTH_DATA) {
    
    const baseMessage = standardError.message;
    return baseMessage.includes('platform') 
      ? baseMessage
      : `${baseMessage} (${platform})`;
  }
  
  return standardError.message;
}

/**
 * Use this function to log errors with consistent formatting
 */
export function logError(
  context: string,
  error: unknown,
  additionalInfo?: Record<string, unknown>
): void {
  const standardError = standardizeError(error);
  
  console.error(
    `[${context}] ${standardError.category.toUpperCase()} ERROR:`,
    standardError.message,
    additionalInfo ? { ...additionalInfo, originalError: standardError.originalError } : standardError.originalError
  );
}

/**
 * Helper function to handle errors in components and hooks
 */
export function handleError(
  error: unknown,
  setErrorFn: (error: string) => void,
  context: string = 'App'
): void {
  const standardError = standardizeError(error);
  logError(context, error);
  setErrorFn(standardError.message);
}
