import React, { createContext, useContext, useEffect } from 'react';

interface NavigationState {
  isReady: boolean;
  isPermissionsHandled: boolean;
}

const NavigationReadyContext = createContext<NavigationState>({
  isReady: false,
  isPermissionsHandled: false,
});

export function NavigationReadyProvider({
  children,
  value,
  permissionsHandled = false,
}: {
  children: React.ReactNode;
  value: boolean;
  permissionsHandled?: boolean;
}) {
  useEffect(() => {
    console.log('[NavigationReadyProvider] Navigation state changed:', {
      isReady: value,
      isPermissionsHandled: permissionsHandled,
    });
  }, [value, permissionsHandled]);

  return (
    <NavigationReadyContext.Provider
      value={{
        isReady: value,
        isPermissionsHandled: permissionsHandled,
      }}
    >
      {children}
    </NavigationReadyContext.Provider>
  );
}

export function useNavigationReady() {
  const state = useContext(NavigationReadyContext);
  return state;
}
