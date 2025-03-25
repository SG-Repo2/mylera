import { Session, User } from '@supabase/supabase-js';

// Ensure PermissionStatus is properly typed
export type PermissionStatus = 'granted' | 'denied' | 'not_determined';

export interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  healthPermissionStatus: PermissionStatus | null;
  healthDataInitialized: boolean;
  register: (email: string, password: string, profileData?: RegisterProfileData) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  requestHealthPermissions: () => Promise<PermissionStatus>;
  needsHealthSetup: () => boolean;
}

export interface RegisterProfileData {
  displayName: string;
  deviceType: 'os' | 'fitbit';
  measurementSystem: 'metric' | 'imperial';
  avatarUri?: string | null;
  showProfile?: boolean;
}

export type PermissionState = { status: string } | string;

export interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  healthPermissionStatus: PermissionStatus | null;
  healthDataInitialized: boolean;
  isAuthNavigationLocked: boolean;
}
