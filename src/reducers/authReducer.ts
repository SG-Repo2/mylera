import { Session, User } from "@supabase/supabase-js";
import { PermissionStatus } from "@/src/providers/health/types/permissions";
import { StandardError } from "../utils/errorUtils";

/**
 * Authentication State Definition
 * Consolidates all authentication and health permission related state
 */
export interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: StandardError | null;
  healthPermissionStatus: PermissionStatus | null;
  healthDataInitialized: boolean;
  isAuthNavigationLocked: boolean;
}

/**
 * Initial Authentication State
 */
export const initialAuthState: AuthState = {
  session: null,
  user: null,
  loading: true,
  error: null,
  healthPermissionStatus: null,
  healthDataInitialized: false,
  isAuthNavigationLocked: false,
};

/**
 * Authentication Action Types
 * Defines all possible actions that can change the auth state
 */
export enum AuthActionType {
  SET_SESSION = 'auth/SET_SESSION',
  SET_USER = 'auth/SET_USER',
  SET_LOADING = 'auth/SET_LOADING',
  SET_ERROR = 'auth/SET_ERROR',
  CLEAR_ERROR = 'auth/CLEAR_ERROR',
  SET_HEALTH_PERMISSION_STATUS = 'auth/SET_HEALTH_PERMISSION_STATUS',
  SET_HEALTH_DATA_INITIALIZED = 'auth/SET_HEALTH_DATA_INITIALIZED',
  LOCK_AUTH_NAVIGATION = 'auth/LOCK_AUTH_NAVIGATION',
  UNLOCK_AUTH_NAVIGATION = 'auth/UNLOCK_AUTH_NAVIGATION',
  START_AUTH_OPERATION = 'auth/START_AUTH_OPERATION',
  END_AUTH_OPERATION = 'auth/END_AUTH_OPERATION',
  START_HEALTH_OPERATION = 'auth/START_HEALTH_OPERATION',
  END_HEALTH_OPERATION = 'auth/END_HEALTH_OPERATION',
  LOGOUT = 'auth/LOGOUT',
}

/**
 * Authentication Action Definitions
 */
type SetSessionAction = {
  type: AuthActionType.SET_SESSION;
  payload: Session | null;
};

type SetUserAction = {
  type: AuthActionType.SET_USER;
  payload: User | null;
};

type SetLoadingAction = {
  type: AuthActionType.SET_LOADING;
  payload: boolean;
};

type SetErrorAction = {
  type: AuthActionType.SET_ERROR;
  payload: StandardError;
};

type ClearErrorAction = {
  type: AuthActionType.CLEAR_ERROR;
};

type SetHealthPermissionStatusAction = {
  type: AuthActionType.SET_HEALTH_PERMISSION_STATUS;
  payload: PermissionStatus | null;
};

type SetHealthDataInitializedAction = {
  type: AuthActionType.SET_HEALTH_DATA_INITIALIZED;
  payload: boolean;
};

type LockAuthNavigationAction = {
  type: AuthActionType.LOCK_AUTH_NAVIGATION;
};

type UnlockAuthNavigationAction = {
  type: AuthActionType.UNLOCK_AUTH_NAVIGATION;
};

type StartAuthOperationAction = {
  type: AuthActionType.START_AUTH_OPERATION;
};

type EndAuthOperationAction = {
  type: AuthActionType.END_AUTH_OPERATION;
};

type StartHealthOperationAction = {
  type: AuthActionType.START_HEALTH_OPERATION;
};

type EndHealthOperationAction = {
  type: AuthActionType.END_HEALTH_OPERATION;
};

type LogoutAction = {
  type: AuthActionType.LOGOUT;
};

/**
 * Union of all possible auth actions
 */
export type AuthAction =
  | SetSessionAction
  | SetUserAction
  | SetLoadingAction
  | SetErrorAction
  | ClearErrorAction
  | SetHealthPermissionStatusAction
  | SetHealthDataInitializedAction
  | LockAuthNavigationAction
  | UnlockAuthNavigationAction
  | StartAuthOperationAction
  | EndAuthOperationAction
  | StartHealthOperationAction
  | EndHealthOperationAction
  | LogoutAction;

/**
 * Authentication Reducer
 * Handles all state transitions in a predictable way
 */
export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case AuthActionType.SET_SESSION:
      return {
        ...state,
        session: action.payload,
      };
    
    case AuthActionType.SET_USER:
      return {
        ...state,
        user: action.payload,
      };
    
    case AuthActionType.SET_LOADING:
      return {
        ...state,
        loading: action.payload,
      };
    
    case AuthActionType.SET_ERROR:
      return {
        ...state,
        error: action.payload,
      };
    
    case AuthActionType.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };
    
    case AuthActionType.SET_HEALTH_PERMISSION_STATUS:
      return {
        ...state,
        healthPermissionStatus: action.payload,
      };
    
    case AuthActionType.SET_HEALTH_DATA_INITIALIZED:
      return {
        ...state,
        healthDataInitialized: action.payload,
      };
    
    case AuthActionType.LOCK_AUTH_NAVIGATION:
      return {
        ...state,
        isAuthNavigationLocked: true,
      };
    
    case AuthActionType.UNLOCK_AUTH_NAVIGATION:
      return {
        ...state,
        isAuthNavigationLocked: false,
      };
    
    case AuthActionType.START_AUTH_OPERATION:
      return {
        ...state,
        loading: true,
        error: null,
        isAuthNavigationLocked: true,
        healthDataInitialized: false,
      };
    
    case AuthActionType.END_AUTH_OPERATION:
      return {
        ...state,
        loading: false,
        isAuthNavigationLocked: false,
      };
    
    case AuthActionType.START_HEALTH_OPERATION:
      return {
        ...state,
        loading: true,
        error: null,
        healthDataInitialized: false,
      };
    
    case AuthActionType.END_HEALTH_OPERATION:
      return {
        ...state,
        loading: false,
        healthDataInitialized: true,
      };
    
    case AuthActionType.LOGOUT:
      return {
        ...initialAuthState,
        loading: false,
      };
    
    default:
      return state;
  }
}

/**
 * Action creators for auth actions
 */
export const authActions = {
  setSession: (session: Session | null): SetSessionAction => ({
    type: AuthActionType.SET_SESSION,
    payload: session,
  }),
  
  setUser: (user: User | null): SetUserAction => ({
    type: AuthActionType.SET_USER,
    payload: user,
  }),
  
  setLoading: (loading: boolean): SetLoadingAction => ({
    type: AuthActionType.SET_LOADING,
    payload: loading,
  }),
  
  setError: (error: StandardError): SetErrorAction => ({
    type: AuthActionType.SET_ERROR,
    payload: error,
  }),
  
  clearError: (): ClearErrorAction => ({
    type: AuthActionType.CLEAR_ERROR,
  }),
  
  setHealthPermissionStatus: (status: PermissionStatus | null): SetHealthPermissionStatusAction => ({
    type: AuthActionType.SET_HEALTH_PERMISSION_STATUS,
    payload: status,
  }),
  
  setHealthDataInitialized: (initialized: boolean): SetHealthDataInitializedAction => ({
    type: AuthActionType.SET_HEALTH_DATA_INITIALIZED,
    payload: initialized,
  }),
  
  lockAuthNavigation: (): LockAuthNavigationAction => ({
    type: AuthActionType.LOCK_AUTH_NAVIGATION,
  }),
  
  unlockAuthNavigation: (): UnlockAuthNavigationAction => ({
    type: AuthActionType.UNLOCK_AUTH_NAVIGATION,
  }),
  
  startAuthOperation: (): StartAuthOperationAction => ({
    type: AuthActionType.START_AUTH_OPERATION,
  }),
  
  endAuthOperation: (): EndAuthOperationAction => ({
    type: AuthActionType.END_AUTH_OPERATION,
  }),
  
  startHealthOperation: (): StartHealthOperationAction => ({
    type: AuthActionType.START_HEALTH_OPERATION,
  }),
  
  endHealthOperation: (): EndHealthOperationAction => ({
    type: AuthActionType.END_HEALTH_OPERATION,
  }),
  
  logout: (): LogoutAction => ({
    type: AuthActionType.LOGOUT,
  }),
}; 