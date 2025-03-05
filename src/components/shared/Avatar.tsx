import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { theme } from '../../theme/theme';

interface AvatarProps {
  url: string | null;
  size: number;
  name?: string;
  borderColor?: string;
  borderWidth?: number;
  style?: any;
}

export function Avatar({ url, size, name = '', borderColor = '#E2E8F0', borderWidth = 2, style }: AvatarProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(!!url);
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);
  
  // Get the first letter of the name or use a fallback
  const firstLetter = (name && name.length > 0) ? name.charAt(0).toUpperCase() : '?';
  
  // Generate a consistent background color based on the name
  const getBackgroundColor = (name: string) => {
    const colors = ['#4F46E5', '#7C3AED', '#0891B2', '#2563EB', '#9333EA', '#DB2777', '#DC2626'];
    if (!name) return colors[0];
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
      sum += name.charCodeAt(i);
    }
    return colors[sum % colors.length];
  };
  
  const bgColor = getBackgroundColor(name);

  // Add cache busting to the URL
  useEffect(() => {
    if (url) {
      // Generate unique timestamp for cache busting
      const timestamp = Date.now();
      const newUrl = url.includes('?') 
        ? `${url}&t=${timestamp}` 
        : `${url}?t=${timestamp}`;
      
      setCachedUrl(newUrl);
      setHasError(false);
      setIsLoading(true);
    } else {
      setCachedUrl(null);
      setIsLoading(false);
    }
  }, [url]);

  // Only try to render the image if URL exists and no previous error
  const shouldRenderImage = cachedUrl && !hasError;

  return (
    <View 
      style={[
        styles.container, 
        { 
          width: size, 
          height: size, 
          borderRadius: size / 2,
          borderColor,
          borderWidth,
          backgroundColor: bgColor,
        },
        style
      ]}
    >
      {shouldRenderImage ? (
        <>
          {isLoading && (
            <ActivityIndicator 
              size="small" 
              color="#FFFFFF" 
              style={styles.loader} 
            />
          )}
          <Image
            source={{ uri: cachedUrl }}
            style={{ 
              width: '100%', 
              height: '100%', 
              borderRadius: size / 2,
              opacity: isLoading ? 0.3 : 1
            }}
            contentFit="cover"
            transition={200}
            cachePolicy="none"
            onError={() => {
              console.log('[Avatar] Image load error for:', name);
              setHasError(true);
              setIsLoading(false);
            }}
            onLoad={() => {
              setIsLoading(false);
            }}
          />
        </>
      ) : (
        <Text style={[styles.letter, { fontSize: size * 0.4 }]}>
          {firstLetter}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  letter: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  loader: {
    position: 'absolute',
  }
});
