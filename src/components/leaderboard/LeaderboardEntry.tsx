import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { LeaderboardEntry as LeaderboardEntryType } from '../../types/leaderboard';
import { leaderboardEntryStyles } from '../../styles/leaderboardEntryStyles';
import AvatarDisplay from '../AvatarDisplay';

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
      // Log the avatar URL for debugging
      console.log(`[LeaderboardEntry] Rendering avatar for ${display_name}:`, avatar_url);
      
      return (
        <AvatarDisplay 
          avatarId={avatar_url}
          
          style={[
            leaderboardEntryStyles.avatar,
            isPodium && position === 1 && leaderboardEntryStyles.firstPlaceAvatar,
            isPodium && (position === 2 || position === 3) && leaderboardEntryStyles.podiumAvatar
          ] as any}
        />
      );
    }
    
    return (
      <View 
        style={[
          leaderboardEntryStyles.avatarPlaceholder,
          isPodium && position === 1 && leaderboardEntryStyles.firstPlaceAvatar,
          isPodium && (position === 2 || position === 3) && leaderboardEntryStyles.podiumAvatar
        ]} 
        testID="avatar-placeholder"
      >
        <Text style={[leaderboardEntryStyles.avatarLetter, highlight && leaderboardEntryStyles.highlightText]}>
          {display_name?.charAt(0).toUpperCase() ?? '?'}
        </Text>
      </View>
    );
  };

  if (variant === 'podium') {
    return (
      <View
        style={[leaderboardEntryStyles.podiumContainer, highlight && leaderboardEntryStyles.highlightBackground]}
        testID="leaderboard-entry-podium"
      >
        {position === 1 && (
          <MaterialCommunityIcons
            name="crown"
            size={32}
            color="#FFD700"
            style={leaderboardEntryStyles.crown}
          />
        )}
        <Animated.View 
          style={[
            leaderboardEntryStyles.podiumContent,
            { transform: [{ scale: scaleAnim }] }
          ]}
        >
          <View style={leaderboardEntryStyles.podiumAvatarContainer}>
            {renderAvatar(true)}
          </View>
          <Text 
            style={[
              leaderboardEntryStyles.podiumDisplayName, 
              highlight && leaderboardEntryStyles.highlightText,
              position === 1 && leaderboardEntryStyles.firstPlaceText
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {display_name}
          </Text>
          <Animated.Text 
            style={[
              leaderboardEntryStyles.podiumPoints,
              highlight && leaderboardEntryStyles.highlightText,
              position === 1 && leaderboardEntryStyles.firstPlacePoints,
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
      style={[leaderboardEntryStyles.container, highlight && leaderboardEntryStyles.highlightBackground]}
      accessibilityRole="text"
      accessibilityLabel={`${display_name}, Rank ${rank}, ${total_points} points`}
      accessibilityHint={highlight ? "This is your position on the leaderboard" : undefined}
      testID="leaderboard-entry"
    >
      <Animated.View 
        style={[
          leaderboardEntryStyles.mainContent,
          { transform: [{ scale: scaleAnim }] }
        ]}
      >
        {/* Rank */}
        <View style={leaderboardEntryStyles.rankContainer}>
          <Animated.Text 
            style={[
              leaderboardEntryStyles.rankText, 
              highlight && leaderboardEntryStyles.highlightText,
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
        <View style={leaderboardEntryStyles.avatarContainer}>
          {renderAvatar()}
        </View>

        {/* User Info */}
        <View style={leaderboardEntryStyles.infoContainer}>
          <Text 
            style={[leaderboardEntryStyles.displayName, highlight && leaderboardEntryStyles.highlightText]}
            testID="display-name"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {display_name}
          </Text>
          <Animated.Text 
            style={[
              leaderboardEntryStyles.pointsText, 
              highlight && leaderboardEntryStyles.highlightText,
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
