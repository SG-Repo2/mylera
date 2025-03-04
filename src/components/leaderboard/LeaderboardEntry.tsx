import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { LeaderboardEntry as LeaderboardEntryType } from '../../types/leaderboard';
import { theme } from '../../theme/theme';
import { Avatar } from '../shared/Avatar';

const ANIMATION_DURATION = 300;

interface Props {
  entry: LeaderboardEntryType;
  highlight?: boolean;
  variant?: 'standard' | 'podium';
  position?: number;
}

/**
 * Displays individual leaderboard entry in either standard or podium layout.
 */
export function LeaderboardEntry({ 
  entry, 
  highlight = false, 
  variant = 'standard',
  position 
}: Props) {
  const { display_name, avatar_url, total_points, rank } = entry;
  
  // Animation values
  const rankAnim = useRef(new Animated.Value(rank)).current;
  const pointsAnim = useRef(new Animated.Value(total_points)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevRankRef = useRef(rank);
  const prevPointsRef = useRef(total_points);

  // Animate when rank or points change
  useEffect(() => {
    const animations = [];
    
    // Rank changed
    if (prevRankRef.current !== rank) {
      animations.push(
        Animated.timing(rankAnim, {
          toValue: rank,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        })
      );
      prevRankRef.current = rank;
    }
    
    // Points changed
    if (prevPointsRef.current !== total_points) {
      animations.push(
        Animated.timing(pointsAnim, {
          toValue: total_points,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        })
      );
      
      // Add scale pulse animation
      animations.push(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.05,
            duration: ANIMATION_DURATION / 2,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: ANIMATION_DURATION / 2,
            useNativeDriver: true,
          }),
        ])
      );
      
      prevPointsRef.current = total_points;
    }
    
    if (animations.length > 0) {
      Animated.parallel(animations).start();
    }
  }, [rank, total_points, rankAnim, pointsAnim, scaleAnim]);

  if (variant === 'podium') {
    return (
      <View style={styles.podiumContainer}>
        <Avatar 
          url={avatar_url}
          size={position === 1 ? 88 : 72}
          name={display_name}
          borderColor={position === 1 ? '#FFD700' : '#E2E8F0'}
          borderWidth={position === 1 ? 3 : 2}
          style={styles.podiumAvatar}
        />
        <Text 
          style={[
            styles.podiumDisplayName,
            position === 1 && styles.firstPlaceText
          ]}
          numberOfLines={1}
        >
          {display_name || 'Anonymous'}
        </Text>
        <Text 
          style={[
            styles.podiumPoints,
            position === 1 && styles.firstPlacePoints
          ]}
        >
          {total_points} pts
        </Text>
      </View>
    );
  }

  return (
    <Animated.View 
      style={[
        styles.container,
        highlight && styles.highlighted,
        { transform: [{ scale: scaleAnim }] }
      ]}
    >
      <View style={styles.rankContainer}>
        <MaterialCommunityIcons 
          name={rank <= 3 ? 'trophy' : 'medal-outline'} 
          size={24} 
          color={rank <= 3 ? '#FFD700' : '#94A3B8'}
        />
        <Text style={styles.rank}>#{rank}</Text>
      </View>
      
      <Avatar 
        url={avatar_url}
        size={56}
        name={display_name}
        style={styles.avatar}
      />
      
      <View style={styles.infoContainer}>
        <Text style={styles.displayName} numberOfLines={1}>
          {display_name || 'Anonymous'}
        </Text>
        <Text style={styles.points}>
          {total_points} pts
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    padding: 12,
    overflow: 'hidden', // Add this to contain the shadow
  },
  highlighted: {
    backgroundColor: theme.colors.primaryContainer,
  },
  rankContainer: {
    alignItems: 'center',
    marginRight: 12,
  },
  rank: {
    ...theme.fonts.titleSmall,
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
  },
  displayName: {
    ...theme.fonts.titleMedium,
    color: theme.colors.onSurface,
  },
  points: {
    ...theme.fonts.bodyMedium,
    color: theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  podiumContainer: {
    alignItems: 'center',
    padding: 16,
  },
  podiumDisplayName: {
    ...theme.fonts.titleMedium,
    color: theme.colors.onSurface,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
    paddingHorizontal: 4,
    marginTop: 25,
  },
  firstPlaceText: {
    ...theme.fonts.titleLarge,
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 20,
  },
  podiumPoints: {
    ...theme.fonts.titleMedium,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
    fontSize: 14,
    marginTop: 4,
  },
  firstPlacePoints: {
    ...theme.fonts.titleLarge,
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 18,
  },
  podiumAvatar: {
    marginBottom: -16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
});
