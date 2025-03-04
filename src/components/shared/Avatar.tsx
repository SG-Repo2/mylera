import React, { useState, useEffect } from 'react';
import {  View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { theme } from '../../theme/theme';
import { getCachedAvatarUrl } from '../../utils/imageUtils';
import { Image } from 'expo-image';
interface AvatarProps {
  url: string | null;
  size?: number;
  name?: string;
  style?: any;
  borderColor?: string;
  borderWidth?: number;
}

export const Avatar = ({ 
  url, 
  size = 56, 
  name, 
  style,
  borderColor,
  borderWidth 
}: AvatarProps) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 2;
  
  useEffect(() => {
    if (url) {
      const cachedUrl = getCachedAvatarUrl(url);
      setAvatarUrl(cachedUrl);
      setIsLoading(true);
      setHasError(false);
      setRetryCount(0);
    } else {
      setAvatarUrl(null);
      setIsLoading(false);
      setHasError(false);
    }
  }, [url]);
  
  const handleRetry = () => {
    if (url && retryCount < MAX_RETRIES) {
      const cachedUrl = getCachedAvatarUrl(url);
      setAvatarUrl(cachedUrl);
      setIsLoading(true);
      setHasError(false);
      setRetryCount(prev => prev + 1);
    }
  };
  
  if (!avatarUrl || hasError) {
    return (
      <View style={[
        styles.placeholder,
        { 
          width: size, 
          height: size, 
          borderRadius: size / 2,
          borderColor,
          borderWidth
        },
        style
      ]}>
        <Text style={[
          styles.placeholderText,
          { fontSize: Math.max(size * 0.4, 16) }
        ]}>
          {name ? name[0].toUpperCase() : '?'}
        </Text>
      </View>
    );
  }
  
  return (
    <View style={[
      { width: size, height: size },
      style
    ]}>
      {isLoading && (
        <ActivityIndicator 
          size="small" 
          color={theme.colors.primary}
          style={styles.loader} 
        />
      )}
      <Image
        source={{
          uri: avatarUrl,
          width: size,
          height: size,
          cache: Platform.select({
            ios: 'reload', // Force reload on iOS
            android: 'default' // Use default caching on Android
          })
        }}
        style={[
          styles.image,
          { 
            width: size, 
            height: size, 
            borderRadius: size / 2,
            borderColor,
            borderWidth
          },
          isLoading && styles.loading
        ]}
        onLoad={() => {
          console.log('[Avatar] Image loaded successfully:', avatarUrl);
          setIsLoading(false);
        }}
        onError={(error) => {
          console.log('[Avatar] Image load error:', error);
          if (retryCount < MAX_RETRIES) {
            handleRetry();
          } else {
            setHasError(true);
            setIsLoading(false);
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    backgroundColor: theme.colors.surfaceVariant,
  },
  loading: {
    opacity: 0.3,
  },
  placeholder: {
    backgroundColor: theme.colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontWeight: '600',
    color: theme.colors.onSurfaceVariant,
  },
  loader: {
    position: 'absolute',
    zIndex: 2,
    alignSelf: 'center',
    top: '50%',
    transform: [{ translateY: -12 }],
  }
}); 