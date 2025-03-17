import React, { createContext, useContext, ReactNode } from 'react';
import { PermissionStatus } from './health/types/permissions';
import { useHealthPermissions } from '../hooks/useHealthPermissions';
import { HealthProviderFactory } from './health/factory/HealthProviderFactory';

/**
 * Health Provider Context Type
 * Defines the interface for consuming components
 */
interface HealthContextType {
  // State
  permissionStatus: PermissionStatus | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Methods
  requestPermissions: () => Promise<PermissionStatus>;
  initializeHealthProvider: (force?: boolean) => Promise<PermissionStatus | null>;
  needsHealthSetup: () => boolean;
  cleanupHealthProvider: () => Promise<void>;
  getProvider: () => ReturnType<typeof HealthProviderFactory.getProvider>;
}

// Create context with undefined default value
const HealthContext = createContext<HealthContextType | undefined>(undefined);

/**
 * Health Provider Component Properties
 */
interface HealthProviderProps {
  children: ReactNode;
  userId: string | null;
}

/**
 * Health Provider Component
 * Manages health permissions and data separately from authentication
 */
export function HealthProvider({ children, userId }: HealthProviderProps) {
  // Use the health permissions hook
  const {
    permissionStatus,
    isInitialized,
    isLoading,
    error,
    requestPermissions,
    initializeHealthProvider,
    needsHealthSetup,
    cleanupHealthProvider,
  } = useHealthPermissions(userId);

  /**
   * Get the health provider instance
   */
  const getProvider = () => {
    return HealthProviderFactory.getProvider();
  };

  // Create context value
  const contextValue: HealthContextType = {
    permissionStatus,
    isInitialized,
    isLoading,
    error,
    requestPermissions,
    // Fix type mismatch by ensuring initializeHealthProvider returns the correct type
    initializeHealthProvider: async (force?: boolean) => {
      const result = await initializeHealthProvider(force);
      // Ensure we always return PermissionStatus | null, never undefined
      return result === undefined ? null : result;
    },
    needsHealthSetup,
    cleanupHealthProvider,
    getProvider,
  };

  return <HealthContext.Provider value={contextValue}>{children}</HealthContext.Provider>;
}

/**
 * Custom hook to use health context
 */
export function useHealth() {
  const context = useContext(HealthContext);
  if (context === undefined) {
    throw new Error('useHealth must be used within a HealthProvider');
  }
  return context;
} 