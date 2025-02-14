/**
 * Configuration constants for the application
 */

// Maximum size for avatar images (5MB)
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// Valid mime types for avatar images
export const VALID_AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/jpg'] as const;

// Maximum upload retry attempts
export const MAX_UPLOAD_RETRIES = 3;

// Upload timeout in milliseconds (30 seconds)
export const UPLOAD_TIMEOUT = 30000;