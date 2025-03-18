import React, { useMemo } from 'react';
import { Image, StyleSheet, View, Text, ImageSourcePropType, ImageStyle, ViewStyle, TextStyle } from 'react-native';
import { getAvatarSource } from '../utils/avatarUtils';

interface AvatarDisplayProps {
  avatarId?: string | number | null;
  displayName?: string | null;
  size?: number;
  style?: ImageStyle;
  textStyle?: TextStyle;
  defaultImage?: ImageSourcePropType;
  testID?: string;
}

// Use a cache for avatar sources to avoid redundant calculations
const avatarSourceCache = new Map<string, ImageSourcePropType>();

const AvatarDisplayComponent = ({ 
  avatarId,
  displayName,
  size = 50,
  style,
  textStyle,
  defaultImage,
  testID,
}: AvatarDisplayProps) => {
  // Only log in development to avoid excessive production logging
  if (__DEV__) {
    console.log('[AvatarDisplay] Received avatarId:', avatarId);
  }
  
  // Memoize the avatar source calculation
  const avatarSource = useMemo(() => {
    // Return from cache if available
    const cacheKey = `${avatarId}-${defaultImage ? 'default' : 'nodefault'}`;
    if (avatarSourceCache.has(cacheKey)) {
      return avatarSourceCache.get(cacheKey);
    }
    
    // Calculate source and cache it
    const source = getAvatarSource(String(avatarId), defaultImage);
    avatarSourceCache.set(cacheKey, source);
    return source;
  }, [avatarId, defaultImage]);

  // Determine if we should show a letter placeholder
  const showLetter = !avatarId && displayName && displayName.length > 0;
  const firstLetter = displayName ? displayName.charAt(0).toUpperCase() : '?';
  
  // Apply consistent size
  const sizeStyle = { width: size, height: size, borderRadius: size / 2 };
  
  if (showLetter) {
    return (
      <View 
        style={[styles.letterContainer, sizeStyle, style]} 
        testID={testID ? `${testID}-placeholder` : 'avatar-placeholder'}
      >
        <Text style={[styles.letter, textStyle, { fontSize: size * 0.4 }]}>
          {firstLetter}
        </Text>
      </View>
    );
  }
  
  return (
    <Image
      source={avatarSource as ImageSourcePropType}
      style={[styles.avatar, sizeStyle, style]}
      resizeMode="cover"
      testID={testID}
    />
  );
};

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: '#E5E7EB', // Light gray background
  },
  letterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1', // Indigo color
  },
  letter: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  }
});

// Memoize the component with a custom equality function
const AvatarDisplay = React.memo(AvatarDisplayComponent, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.avatarId === nextProps.avatarId &&
    prevProps.size === nextProps.size &&
    prevProps.displayName === nextProps.displayName
  );
});

export default AvatarDisplay;
