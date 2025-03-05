import React, { createContext, useContext, useEffect } from 'react';

// Context to track when the navigator is fully mounted and ready
const NavigationReadyContext = createContext<boolean>(false);

// Provider component
export function NavigationReadyProvider({ 
  children, 
  value 
}: { 
  children: React.ReactNode; 
  value: boolean;
}) {
  // Log when the value changes
  useEffect(() => {
    console.log('[NavigationReadyProvider] Navigation ready state changed:', value);
  }, [value]);

  return (
    <NavigationReadyContext.Provider value={value}>
      {children}
    </NavigationReadyContext.Provider>
  );
}

// Hook to access the navigation ready state
export function useNavigationReady() {
  const value = useContext(NavigationReadyContext);
  return value;
} 