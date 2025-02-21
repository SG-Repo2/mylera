import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionManager } from '../permissions';
import { HealthProviderPermissionError } from '../errors';

describe('PermissionManager', () => {
  let manager: PermissionManager;
  const userId = 'test-user';

  beforeEach(() => {
    jest.resetAllMocks();
    manager = new PermissionManager(userId);
  });

  describe('getPermissionState', () => {
    it('returns cached state if available', async () => {
      const mockState = {
        status: 'granted' as const,
        lastChecked: Date.now(),
      };

      // Mock implementation for this specific test
      jest.spyOn(AsyncStorage, 'getItem')
        .mockImplementationOnce(() => Promise.resolve(JSON.stringify(mockState)));
      
      const state1 = await manager.getPermissionState();
      const state2 = await manager.getPermissionState();

      expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);
      expect(state1).toEqual(mockState);
      expect(state2).toEqual(mockState);
    });

    it('returns null for expired state', async () => {
      const oldState = {
        status: 'granted' as const,
        lastChecked: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
      };

      jest.spyOn(AsyncStorage, 'getItem')
        .mockImplementationOnce(() => Promise.resolve(JSON.stringify(oldState)));
      
      const state = await manager.getPermissionState();
      expect(state).toBeNull();
    });
  });

  describe('updatePermissionState', () => {
    it('updates state and persists to cache', async () => {
      const setItemSpy = jest.spyOn(AsyncStorage, 'setItem')
        .mockImplementationOnce(() => Promise.resolve());

      await manager.updatePermissionState('granted');

      expect(setItemSpy).toHaveBeenCalled();
      const savedState = JSON.parse(setItemSpy.mock.calls[0][1]);
      expect(savedState.status).toBe('granted');
      expect(savedState.lastChecked).toBeDefined();
    });

    it('preserves denied permissions on update', async () => {
      const initialState = {
        status: 'denied' as const,
        lastChecked: Date.now(),
        deniedPermissions: ['steps']
      };

      jest.spyOn(AsyncStorage, 'getItem')
        .mockImplementationOnce(() => Promise.resolve(JSON.stringify(initialState)));
      
      const setItemSpy = jest.spyOn(AsyncStorage, 'setItem')
        .mockImplementationOnce(() => Promise.resolve());

      await manager.updatePermissionState('limited');

      const savedState = JSON.parse(setItemSpy.mock.calls[0][1]);
      expect(savedState.status).toBe('limited');
      expect(savedState.deniedPermissions).toEqual(['steps']);
    });
  });

  describe('handlePermissionDenial', () => {
    it('adds permission to denied list', async () => {
      const setItemSpy = jest.spyOn(AsyncStorage, 'setItem')
        .mockImplementationOnce(() => Promise.resolve());

      await manager.handlePermissionDenial('steps');

      const savedState = JSON.parse(setItemSpy.mock.calls[0][1]);
      expect(savedState.status).toBe('denied');
      expect(savedState.deniedPermissions).toContain('steps');
    });
  });

  describe('handlePermissionError', () => {
    it('handles denial errors by updating denied permissions', async () => {
      const setItemSpy = jest.spyOn(AsyncStorage, 'setItem')
        .mockImplementationOnce(() => Promise.resolve());

      await manager.handlePermissionError('steps', new Error('Permission denied'));

      const savedState = JSON.parse(setItemSpy.mock.calls[0][1]);
      expect(savedState.status).toBe('denied');
      expect(savedState.deniedPermissions).toContain('steps');
    });

    it('sets state to not_determined for non-denial errors', async () => {
      const setItemSpy = jest.spyOn(AsyncStorage, 'setItem')
        .mockImplementationOnce(() => Promise.resolve());

      await manager.handlePermissionError('steps', new Error('Network error'));

      const savedState = JSON.parse(setItemSpy.mock.calls[0][1]);
      expect(savedState.status).toBe('not_determined');
    });
  });

  describe('error handling', () => {
    it('handles cache read errors gracefully', async () => {
      jest.spyOn(AsyncStorage, 'getItem')
        .mockImplementationOnce(() => Promise.reject(new Error('Read error')));
      
      const state = await manager.getPermissionState();
      expect(state).toBeNull();
    });

    it('handles cache write errors', async () => {
      jest.spyOn(AsyncStorage, 'setItem')
        .mockImplementationOnce(() => Promise.reject(new Error('Write error')));
      
      await expect(
        manager.updatePermissionState('granted')
      ).rejects.toThrow(HealthProviderPermissionError);
    });
  });

  describe('state validation', () => {
    it('clears invalid cached state', async () => {
      jest.spyOn(AsyncStorage, 'getItem')
        .mockImplementationOnce(() => Promise.resolve(JSON.stringify({
          status: 'invalid_status',
          lastChecked: Date.now()
        })));

      jest.spyOn(AsyncStorage, 'removeItem')
        .mockImplementationOnce(() => Promise.resolve());

      const state = await manager.getPermissionState();
      expect(state).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalled();
    });
  });
}); 