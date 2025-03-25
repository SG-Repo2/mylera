import { ImageSourcePropType } from 'react-native';

/**
 * Gets the appropriate image source based on avatar URL or index
 * @param avatarUrl - Can be a URL string or a numeric index as string
 * @param defaultImage - Optional default image to use if no avatar is provided
 */
export const getAvatarSource = (
  avatarUrl: string | null | undefined,
  defaultImage?: ImageSourcePropType
): ImageSourcePropType => {
  // Debug the incoming avatar value
  console.log('[avatarUtils] Processing avatar source:', avatarUrl, typeof avatarUrl);

  // If no avatar URL is provided, return default image
  if (!avatarUrl) {
    console.log('[avatarUtils] No avatar URL provided, using default');
    return defaultImage || require('@/assets/images/favicon.png');
  }

  // Check if the avatar is a numeric string (index) - ensure string comparison
  if (/^\d+$/.test(String(avatarUrl))) {
    const index = parseInt(String(avatarUrl), 10);
    console.log('[avatarUtils] Numeric avatar detected, using index:', index);

    // Select the corresponding avatar image
    try {
      switch (index) {
        case 1:
          return require('@/assets/images/avatars/1.png');
        case 2:
          return require('@/assets/images/avatars/2.png');
        case 3:
          return require('@/assets/images/avatars/3.png');
        case 4:
          return require('@/assets/images/avatars/4.png');
        case 5:
          return require('@/assets/images/avatars/5.png');
        case 6:
          return require('@/assets/images/avatars/6.png');
        default:
          console.log('[avatarUtils] Unknown avatar index, using default avatar 1');
          return require('@/assets/images/avatars/1.png');
      }
    } catch (error) {
      console.error('[avatarUtils] Error loading avatar image:', error);
      return defaultImage || require('@/assets/images/favicon.png');
    }
  }

  // Otherwise treat as a URL
  console.log('[avatarUtils] URL-based avatar detected');
  return { uri: avatarUrl };
};

/**
 * Helper function that handles defaulting to first letter if no avatar
 * @param displayName User's display name
 * @param avatarUrl Avatar URL or index
 */
export const getAvatarDisplay = (
  displayName: string | null | undefined,
  avatarUrl: string | null | undefined
) => {
  const firstLetter = displayName?.charAt(0)?.toUpperCase() || '?';
  const hasAvatar = !!avatarUrl;

  return { firstLetter, hasAvatar };
};
