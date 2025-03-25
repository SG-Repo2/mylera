import { logger } from "@/src/utils/logger";

import { LogCategory } from "@/src/utils/logger";

export class PermissionManager {
  private initialized: boolean = false;
  private userId: string | null = null;

  /**
   * Initialize the permission manager with a user ID
   * @param userId - The user ID to initialize with
   */
  async initialize(userId: string): Promise<void> {
    try {
      // Validate user ID
      if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
        throw new Error('Invalid user ID provided for permission manager initialization');
      }

      this.userId = userId;
      this.initialized = true;

      logger.info(LogCategory.Health, `Permission manager initialized for user ${userId}`);
    } catch (error) {
      logger.error(
        LogCategory.Health,
        `Failed to initialize permission manager: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Check if the permission manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.userId !== null;
  }

  /**
   * Get the current user ID
   */
  getUserId(): string {
    if (!this.isInitialized()) {
      throw new Error('Permission manager not initialized');
    }
    return this.userId!;
  }

  /**
   * Reset the permission manager state
   */
  reset(): void {
    this.initialized = false;
    this.userId = null;
  }
} 