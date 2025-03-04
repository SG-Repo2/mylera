import { Platform } from 'react-native';
import { Image } from 'expo-image';

interface CacheEntry {
  url: string;
  timestamp: number;
}

const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
const avatarCache = new Map<string, CacheEntry>();

export const getCachedAvatarUrl = (baseUrl: string | null): string | null => {
  if (!baseUrl) return null;
  
  const cached = avatarCache.get(baseUrl);
  if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
    return cached.url;
  }
  
  const timestamp = Date.now();
  const newUrl = `${baseUrl}?t=${timestamp}`;
  avatarCache.set(baseUrl, { url: newUrl, timestamp });
  return newUrl;
};

export const clearImageCache = async (url: string | null): Promise<void> => {
  if (!url) return;
  
  try {
    if (Platform.OS === 'ios') {
      await Image.clearMemoryCache();  // Reset entire cache on iOS
    } else {
      await Image.clearDiskCache(); // Clear disk cache on Android
    }

    // Always clear from our in-memory cache
    const baseUrl = url.split('?')[0];
    avatarCache.delete(baseUrl);
  } catch (e) {
    console.warn('Image cache management error:', e);
    // Continue execution - cache clearing is non-critical
  }
};

export const createCacheBustedUrl = (url: string | null): string | null => {
  if (!url) return null;
  return getCachedAvatarUrl(url.split('?')[0]);
}; 