import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, Pressable, StyleSheet, Animated, ImageSourcePropType } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { LeaderboardEntry as LeaderboardEntryType } from '../../types/leaderboard';

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

  // Example metrics - replace with real data from your metrics service
  const expandedMetrics = [
    { key: 'heart_rate', label: 'Heart Rate', value: '72', unit: 'BPM', icon: 'heart-pulse' as const, color: '#A855F7' },
    { key: 'steps', label: 'Steps', value: '8,547', unit: '', icon: 'walk' as const, color: '#0284c7' },
    { key: 'distance', label: 'Distance', value: '3.2', unit: 'mi', icon: 'map-marker-distance' as const, color: '#8B5CF6' },
    { key: 'calories', label: 'Calories', value: '1,850', unit: '', icon: 'fire' as const, color: '#FB923C' },
  ] as const;

  const renderAvatar = () => {
    if (avatar_url) {
      return (
        <Image 
          source={{ uri: avatar_url }} 
          defaultSource={DEFAULT_AVATAR}
          style={styles.avatar} 
        />
      );
    }
    
    return (
      <View style={styles.avatarPlaceholder}>
        <Text style={[styles.avatarLetter, highlight && styles.highlightText]}>
          {display_name?.charAt(0).toUpperCase() ?? '?'}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Pressable
          onPress={() => setIsExpanded(!isExpanded)}
          style={[styles.mainContent, highlight && styles.highlightBackground]}
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
            <Text style={[styles.displayName, highlight && styles.highlightText]}>
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
            >
              {total_points} pts
            </Animated.Text>
            <Text style={styles.metricsText}>
              {metrics_completed} metrics
            </Text>
          </View>

          {/* Expand/Collapse Icon */}
          <MaterialCommunityIcons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={highlight ? '#0284c7' : '#9CA3AF'}
          />
        </Pressable>
      </Animated.View>

      {/* Expanded Content */}
      {isExpanded && (
        <View style={styles.expandedContent}>
          <Text style={styles.expandedTitle}>Today's Metrics</Text>
          <View style={styles.metricsGrid}>
            {expandedMetrics.map((metric) => (
              <View key={metric.key} style={styles.metricCard}>
                <MaterialCommunityIcons
                  name={metric.icon}
                  size={24}
                  color={metric.color}
                  style={styles.metricIcon}
                />
                <Text style={styles.metricValue}>
                  {metric.value}
                  {metric.unit && <Text style={styles.metricUnit}> {metric.unit}</Text>}
                </Text>
                <Text style={styles.metricLabel}>{metric.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: 'white',
    elevation: 1,
    shadowColor: '#000',
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
    backgroundColor: '#E0F2FE',
  },
  rankContainer: {
    marginRight: 12,
    width: 32,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
  },
  highlightText: {
    color: '#0284c7',
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
    backgroundColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  infoContainer: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  pointsText: {
    fontSize: 14,
    color: '#1E293B',
  },
  metricsText: {
    fontSize: 12,
    color: '#6B7280',
  },
  expandedContent: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  expandedTitle: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    alignItems: 'center',
  },
  metricIcon: {
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  metricUnit: {
    fontSize: 14,
    color: '#6B7280',
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
});