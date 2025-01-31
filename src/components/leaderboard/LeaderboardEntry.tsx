import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, Animated } from 'react-native';
import type { LeaderboardEntry as LeaderboardEntryType } from '../../types/leaderboard';
import { theme } from '../../theme/theme';
const ANIMATION_DURATION = 300;
const DEFAULT_AVATAR = require('../../../assets/images/favicon.png');

interface Props {
  entry: LeaderboardEntryType;
  highlight?: boolean;
}

/**
 * Displays individual leaderboard row with expandable details.
 * When expanded, shows additional metrics in a grid layout.
 */
export function LeaderboardEntry({ entry, highlight }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { display_name, avatar_url, total_points, metrics_completed, rank } = entry;
  
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


  const renderAvatar = () => {
    if (avatar_url) {
      return (
        <Image 
          source={{ uri: avatar_url }} 
          defaultSource={DEFAULT_AVATAR}
          style={styles.avatar}
          testID="avatar-image"
        />
      );
    }
    
    return (
      <View style={styles.avatarPlaceholder} testID="avatar-placeholder">
        <Text style={[styles.avatarLetter, highlight && styles.highlightText]}>
          {display_name?.charAt(0).toUpperCase() ?? '?'}
        </Text>
      </View>
    );
  };

  return (
    <View 
      style={[styles.container, highlight && styles.highlightBackground]}
      accessibilityRole="text"
      accessibilityLabel={`${display_name}, Rank ${rank}, ${total_points} points`}
      accessibilityHint={highlight ? "This is your position on the leaderboard" : undefined}
      testID="leaderboard-entry"
    >
      <Animated.View 
        style={[
          styles.mainContent,
          { transform: [{ scale: scaleAnim }] }
        ]}
      >
        {/* Rank */}
        <View style={styles.rankContainer}>
          <Animated.Text 
            style={[
              styles.rankText, 
              highlight && styles.highlightText,
              {
                transform: [{
                  translateY: rankAnim.interpolate({
                    inputRange: [rank - 1, rank, rank + 1],
                    outputRange: [-20, 0, 20]
                  })
                }]
              }
            ]}
            accessibilityLabel={`Rank ${rank}`}
            testID="rank-text"
          >
            {rank}
          </Animated.Text>
        </View>

        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {renderAvatar()}
        </View>

        {/* User Info */}
        <View style={styles.infoContainer}>
          <Text 
            style={[styles.displayName, highlight && styles.highlightText]}
            accessibilityLabel={display_name}
            testID="display-name"
          >
            {display_name}
          </Text>
          <Animated.Text 
            style={[
              styles.pointsText, 
              highlight && styles.highlightText,
              {
                transform: [{
                  translateY: pointsAnim.interpolate({
                    inputRange: [total_points - 100, total_points, total_points + 100],
                    outputRange: [-20, 0, 20]
                  })
                }]
              }
            ]}
            accessibilityLabel={`${total_points} points`}
            testID="points-text"
          >
            {total_points} pts
          </Animated.Text>
        </View>

      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: theme.roundness,
    backgroundColor: theme.colors.surface,
    elevation: 1,
    shadowColor: theme.colors.onSurface,
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  highlightBackground: {
    backgroundColor: theme.colors.primaryContainer,
  },
  rankContainer: {
    marginRight: 12,
    width: 32,
    alignItems: 'center',
  },
  rankText: {
    ...theme.fonts.titleLarge,
    color: theme.colors.onSurface,
  },
  highlightText: {
    color: theme.colors.primary,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    ...theme.fonts.titleLarge,
    color: theme.colors.onSurfaceVariant,
  },
  infoContainer: {
    flex: 1,
  },
  displayName: {
    ...theme.fonts.titleMedium,
    color: theme.colors.onSurface,
  },
  pointsText: {
    ...theme.fonts.bodyMedium,
    color: theme.colors.onSurfaceVariant,
  },
  metricsText: {
    ...theme.fonts.bodySmall,
    color: theme.colors.onSurfaceVariant,
  },
  expandedContent: {
    backgroundColor: theme.colors.surfaceVariant,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  expandedTitle: {
    ...theme.fonts.titleSmall,
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
    marginBottom: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '48%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    padding: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: theme.colors.onSurface,
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    alignItems: 'center',
  },
  metricIcon: {
    marginBottom: 8,
  },
  metricValue: {
    ...theme.fonts.titleLarge,
    color: theme.colors.onSurface,
  },
  metricUnit: {
    ...theme.fonts.bodyMedium,
    color: theme.colors.onSurfaceVariant,
  },
  metricLabel: {
    ...theme.fonts.bodySmall,
    color: theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
});
