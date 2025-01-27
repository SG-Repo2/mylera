import { AppleHealthProvider } from './AppleHealthProvider';
import { GoogleHealthProvider } from './GoogleHealthProvider';

// This is a simple approach: detect platform or user preference
// and return the appropriate health provider instance.

export function createHealthProvider(
  platform: 'apple' | 'google'
) {
  if (platform === 'apple') {
    return new AppleHealthProvider();
  } else {
    return new GoogleHealthProvider();
  }
}