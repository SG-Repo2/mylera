import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

interface AvatarDisplayProps {
  avatarId: number | string | null;
  style?: any; // Using any for style to avoid type conflicts
  testID?: string;
}

const avatarAssets: Record<string, any> = {
  '1': require('../../assets/images/avatars/1.png'),
  '2': require('../../assets/images/avatars/2.png'),
  '3': require('../../assets/images/avatars/3.png'),
  '4': require('../../assets/images/avatars/4.png'),
  '5': require('../../assets/images/avatars/5.png'),
  '6': require('../../assets/images/avatars/6.png'),
  '7': require('../../assets/images/avatars/7.png'),
  '8': require('../../assets/images/avatars/8.png'),
  '9': require('../../assets/images/avatars/9.png'),
  // Add additional mappings as needed
};

const AvatarDisplay: React.FC<AvatarDisplayProps> = ({ avatarId, style, testID }) => {
  // Debug: log the provided avatarId
  console.log('[AvatarDisplay] Received avatarId:', avatarId);

  if (avatarId === null || avatarId === undefined) {
    console.warn('[AvatarDisplay] No avatarId provided');
    return <View style={[styles.avatar, style]} testID={testID ? `${testID}-placeholder` : 'avatar-placeholder'} />;
  }

  // Ensure the avatarId is a string for proper mapping
  const idKey = String(avatarId);
  const avatarSource = avatarAssets[idKey];

  if (!avatarSource) {
    console.warn(`[AvatarDisplay] No avatar asset found for id "${idKey}"`);
    return <View style={[styles.avatar, style]} testID={testID ? `${testID}-placeholder` : 'avatar-placeholder'} />;
  }

  return (
    <Image
      source={avatarSource}
      style={[styles.avatar, style]}
      resizeMode="cover"
      testID={testID}
    />
  );
};

const styles = StyleSheet.create({
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25, // Circular image
  },
});

export default AvatarDisplay; 