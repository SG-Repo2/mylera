# Permission Initialization System Improvements

## Context

We're experiencing permission initialization issues in the health provider system:
1. TypeError: provider.initializePermissions undefined
2. Recurring "Permission manager not initialized" errors

Current implementation has several architectural issues:
- Race conditions between SDK initialization and permission checks
- Unclear initialization sequence
- Inconsistent state management
- Missing error recovery paths
- Auth state and health provider lifecycle misalignment
- Multiple initialization points causing race conditions
- Incomplete error recovery mechanisms

## Decision

We will implement a robust permission initialization system with the following improvements:

### 1. Explicit Permission Manager Initialization

```typescript
class PermissionManager {
  private initialized = false;
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Load cached state
    const state = await getCachedPermissionState(this.userId);
    if (state) {
      this.initialized = true;
      return;
    }
    
    // Initialize fresh state
    await this.updatePermissionState('not_determined');
    this.initialized = true;
  }
  
  async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}
```

### 2. Synchronized Provider Initialization

```typescript
abstract class BaseHealthProvider {
  protected async initializeProvider(): Promise<void> {
    if (this.initialized) return;

    try {
      // 1. Initialize permission manager
      await this.permissionManager?.initialize();
      
      // 2. Initialize platform SDK
      await this.initializePlatformSDK();
      
      // 3. Verify current permissions
      await this.verifyPermissions();
      
      this.initialized = true;
    } catch (error) {
      await this.handleInitializationError(error);
      throw error;
    }
  }
}
```

### 3. Atomic State Updates

```typescript
class PermissionManager {
  async updatePermissionState(
    status: PermissionStatus,
    deniedPermissions?: string[]
  ): Promise<void> {
    await this.ensureInitialized();
    
    const state: PermissionState = {
      status,
      lastChecked: Date.now(),
      deniedPermissions
    };
    
    await cachePermissionState(this.userId, state);
  }
}
```

### 4. Error Recovery Flow

```typescript
abstract class BaseHealthProvider {
  protected async handleInitializationError(error: any): Promise<void> {
    // Reset initialization state
    this.initialized = false;
    
    // Clear permission cache
    await this.permissionManager?.clearCache();
    
    // Log error for monitoring
    console.error('[HealthProvider] Initialization failed:', error);
  }
  
  async reinitialize(): Promise<void> {
    this.initialized = false;
    await this.initialize();
  }
}
```

### 5. Factory Improvements

```typescript
class HealthProviderFactory {
  static async createProvider(userId: string): Promise<HealthProvider> {
    const provider = this.initializeProvider(userId);
    await provider.initialize();
    return provider;
  }

  static async reinitializeProvider(userId: string): Promise<HealthProvider> {
    this.reset();
    return this.createProvider(userId);
  }
}
```

### 6. Auth Integration

```typescript
class AuthHealthManager {
  private static instance: AuthHealthManager;
  private provider: HealthProvider | null = null;
  private initializationPromise: Promise<void> | null = null;

  static getInstance(): AuthHealthManager {
    if (!this.instance) {
      this.instance = new AuthHealthManager();
    }
    return this.instance;
  }

  async initializeHealth(userId: string): Promise<PermissionStatus> {
    if (this.initializationPromise) {
      await this.initializationPromise;
      return this.provider!.checkPermissionsStatus();
    }

    this.initializationPromise = (async () => {
      try {
        this.provider = await HealthProviderFactory.createProvider(userId);
        const state = await this.provider.checkPermissionsStatus();
        return state.status;
      } catch (error) {
        console.error('Health initialization failed:', error);
        await this.handleInitializationError(error);
        return 'not_determined';
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  async handleAuthStateChange(userId: string | null): Promise<void> {
    if (!userId) {
      await this.cleanup();
      return;
    }

    await this.initializeHealth(userId);
  }

  private async handleInitializationError(error: any): Promise<void> {
    this.provider = null;
    // Implement retry logic or user notification
  }

  private async cleanup(): Promise<void> {
    if (this.provider) {
      await this.provider.cleanup();
      this.provider = null;
    }
    HealthProviderFactory.reset();
  }
}
```

### 7. Error Recovery Strategy

```typescript
interface HealthInitializationError extends Error {
  code: 'permission_denied' | 'sdk_error' | 'network_error';
  retry?: boolean;
}

class HealthInitializationManager {
  private static MAX_RETRIES = 3;
  private retryCount = 0;

  async initializeWithRetry(userId: string): Promise<PermissionStatus> {
    try {
      return await this.initialize(userId);
    } catch (error) {
      if (this.shouldRetry(error) && this.retryCount < HealthInitializationManager.MAX_RETRIES) {
        this.retryCount++;
        return this.initializeWithRetry(userId);
      }
      throw error;
    }
  }

  private shouldRetry(error: any): boolean {
    if (error?.code === 'permission_denied') return false;
    return error?.retry !== false;
  }

  async reset(): Promise<void> {
    this.retryCount = 0;
    await HealthProviderFactory.reset();
  }
}
```

## Implementation Steps

1. Update PermissionManager:
   - Add initialization state tracking
   - Implement atomic state updates
   - Add initialization verification

2. Modify BaseHealthProvider:
   - Implement synchronized initialization sequence
   - Add error recovery methods
   - Update permission checking logic

3. Update Platform Providers:
   - Implement platform-specific initialization
   - Add proper error handling
   - Update permission verification

4. Modify Factory:
   - Update provider creation flow
   - Add initialization guarantees
   - Improve error handling

## Consequences

### Positive
- Clear initialization sequence
- Atomic state updates
- Proper error recovery
- Consistent permission state
- Reduced race conditions

### Negative
- Additional initialization overhead
- More complex state management
- Increased error handling complexity

## Status

Proposed

## References

- [Health Permissions Flow](./health-permissions-flow.md)
- [Auth Flow Improvements](./auth-flow-improvements.md)