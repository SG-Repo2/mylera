import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { PermissionManager } from '@/src/providers/health/types/permissions';
import { HEALTH_PERMISSIONS as APPLE_PERMISSIONS } from '@/src/providers/health/platforms/apple/permissions';
import { HEALTH_PERMISSIONS as GOOGLE_PERMISSIONS } from '@/src/providers/health/platforms/google/permissions';
import { HEALTH_PERMISSIONS as FITBIT_PERMISSIONS } from '@/src/providers/health/platforms/fitbit/permissions';

jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn()
  }
}));

describe('PermissionManager', () => {
  let manager: PermissionManager;
  const userId = 'test-user';

  beforeEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    (Platform.select as jest.Mock).mockImplementation(() => 'ios');
  });

  describe('Platform-specific initialization', () => {
    it('initializes correctly for iOS', () => {
      (Platform.select as jest.Mock).mockImplementation(() => 'ios');
      manager = new PermissionManager(userId);
      expect(Platform.OS).toBe('ios');
    });

    it('initializes correctly for Android', () => {
      (Platform.select as jest.Mock).mockImplementation(() => 'android');
      manager = new PermissionManager(userId);
      expect(Platform.OS).toBe('android');
    });
  });

  describe('Permission handling per platform', () => {
    describe('iOS permissions', () => {
      beforeEach(() => {
        (Platform.select as jest.Mock).mockImplementation(() => 'ios');
        manager = new PermissionManager(userId);
      });

      it('handles Apple HealthKit permissions', async () => {
        await manager.handlePermissionDenial(APPLE_PERMISSIONS.HeartRate);
        const state = await manager.getPermissionState();
        expect(state?.deniedPermissions).toContain(APPLE_PERMISSIONS.HeartRate);
      });
    });

    describe('Android permissions', () => {
      beforeEach(() => {
        (Platform.select as jest.Mock).mockImplementation(() => 'android');
        manager = new PermissionManager(userId);
      });

      it('handles Google Health Connect permissions', async () => {
        const permission = GOOGLE_PERMISSIONS.find(p => p.recordType === 'HeartRate');
        await manager.handlePermissionDenial(`${permission?.recordType}`);
        const state = await manager.getPermissionState();
        expect(state?.deniedPermissions).toContain('HeartRate');
      });
    });

    describe('Fitbit permissions', () => {
      beforeEach(() => {
        (Platform.select as jest.Mock).mockImplementation(() => 'web'); // Assuming Fitbit is web-based
        manager = new PermissionManager(userId);
      });

      it('handles Fitbit OAuth scopes', async () => {
        await manager.handlePermissionDenial(FITBIT_PERMISSIONS.heartrate);
        const state = await manager.getPermissionState();
        expect(state?.deniedPermissions).toContain(FITBIT_PERMISSIONS.heartrate);
      });
    });
  });

  describe('Permission state transitions', () => {
    beforeEach(() => {
      manager = new PermissionManager(userId);
    });

    it('handles provisional to granted transition', async () => {
      // Set initial provisional state
      await manager.updatePermissionState('provisional');
      
      // Mock time passage
      jest.advanceTimersByTime(8 * 24 * 60 * 60 * 1000); // 8 days
      
      expect(manager.shouldUpgradeProvisional()).toBe(true);
    });

    it('handles permission upgrade scenarios', async () => {
      await manager.updatePermissionState('limited');
      await manager.updatePermissionState('granted');
      
      const state = await manager.getPermissionState();
      expect(state?.status).toBe('granted');
    });
  });

  describe('Cache behavior', () => {
    it('respects permission cache TTL', async () => {
      const state = {
        status: 'granted' as const,
        lastChecked: Date.now() - (23 * 60 * 60 * 1000), // 23 hours ago
      };

      jest.spyOn(AsyncStorage, 'getItem')
        .mockImplementationOnce(() => Promise.resolve(JSON.stringify(state)));
      
      const result = await manager.getPermissionState();
      expect(result).toEqual(state);
    });
  });
});
