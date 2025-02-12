import React, { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Animated, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { LeaderboardEntry as LeaderboardEntryType } from '../../types/leaderboard';
import { theme } from '../../theme/theme';
import { cardShadow } from '@/src/theme/shadowStyles';

const ANIMATION_DURATION = 300;
const DEFAULT_AVATAR = require('../../../assets/images/favicon.png');

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

  const renderAvatar = (isPodium = false) => {
    if (avatar_url) {
      return (
        <Image 
          source={{ uri: avatar_url }} 
          defaultSource={DEFAULT_AVATAR}
          style={[
            styles.avatar,
            isPodium && position === 1 && styles.firstPlaceAvatar,
            isPodium && (position === 2 || position === 3) && styles.podiumAvatar
          ]}
          testID="avatar-image"
        />
      );
    }
    
    return (
      <View 
        style={[
          styles.avatarPlaceholder,
          isPodium && position === 1 && styles.firstPlaceAvatar,
          isPodium && (position === 2 || position === 3) && styles.podiumAvatar
        ]} 
        testID="avatar-placeholder"
      >
        <Text style={[styles.avatarLetter, highlight && styles.highlightText]}>
          {display_name?.charAt(0).toUpperCase() ?? '?'}
        </Text>
      </View>
    );
  };

  if (variant === 'podium') {
    return (
      <View
        style={[styles.podiumContainer, highlight && styles.highlightBackground]}
        testID="leaderboard-entry-podium"
      >
        {position === 1 && (
          <MaterialCommunityIcons
            name="crown"
            size={32}
            color="#FFD700"
            style={styles.crown}
          />
        )}
        <Animated.View 
          style={[
            styles.podiumContent,
            { transform: [{ scale: scaleAnim }] }
          ]}
        >
          <View style={styles.podiumAvatarContainer}>
            {renderAvatar(true)}
          </View>
          <Text 
            style={[
              styles.podiumDisplayName, 
              highlight && styles.highlightText,
              position === 1 && styles.firstPlaceText
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {display_name}
          </Text>
          <Animated.Text 
            style={[
              styles.podiumPoints,
              highlight && styles.highlightText,
              position === 1 && styles.firstPlacePoints,
              {
                transform: [{
                  translateY: pointsAnim.interpolate({
                    inputRange: [total_points - 100, total_points, total_points + 100],
                    outputRange: [-20, 0, 20]
                  })
                }]
              }
            ]}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {total_points} pts
          </Animated.Text>
        </Animated.View>
      </View>
    );
  }

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
            testID="display-name"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
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
            testID="points-text"
            adjustsFontSizeToFit
            minimumFontScale={0.7}
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
    marginBottom: 12,
    borderRadius: theme.roundness * 1.5,
    backgroundColor: '#FFFFFF',
    ...cardShadow,
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  highlightBackground: {
    backgroundColor: '#BFDBFE',
  },
  rankContainer: {
    marginRight: 12,
    width: 32,
    alignItems: 'center',
  },
  rankText: {
    ...theme.fonts.titleLarge,
    color: '#1E293B',
    fontWeight: '700',
    fontSize: 24,
  },
  highlightText: {
    color: '#1E3A8A',
  },
  avatarContainer: {
    width: 56,
    marginVertical: 8,
  },
  podiumAvatarContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    ...theme.fonts.titleMedium,
    color: '#64748B',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 16,
  },
  displayName: {
    ...theme.fonts.titleMedium,
    color: '#1E293B',
    fontWeight: '600',
    fontSize: 18,
  },
  pointsText: {
    ...theme.fonts.bodyLarge,
    color: '#64748B',
    marginTop: 4,
    fontSize: 16,
  },
  // Podium-specific styles
  crown: {
    position: 'absolute',
    top: -16,
    alignSelf: 'center',
    zIndex: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  podiumContainer: {
    alignItems: 'center',
    padding: 12,
    borderRadius: theme.roundness * 1.5,
    backgroundColor: '#FFFFFF',
    height: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  podiumContent: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 8,
    width: '100%',
  },
  podiumDisplayName: {
    ...theme.fonts.titleMedium,
    color: '#1E293B',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
    paddingHorizontal: 4,
    marginTop: 25,
  },
  firstPlaceText: {
    ...theme.fonts.titleLarge,
    color: '#1E3A8A',
    fontWeight: '700',
    fontSize: 20,
  },
  podiumPoints: {
    ...theme.fonts.titleMedium,
    color: '#64748B',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 4,
  },
  firstPlacePoints: {
    ...theme.fonts.titleLarge,
    color: '#1E3A8A',
    fontWeight: '700',
    fontSize: 18,
  },
  firstPlaceAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  podiumAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
});
