import React, { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { LeaderboardEntry as LeaderboardEntryType } from '../../types/leaderboard';

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

  // Example metrics - replace with real data from your metrics service
  const expandedMetrics = [
    { key: 'heart_rate', label: 'Heart Rate', value: '72', unit: 'BPM', icon: 'heart-pulse' as const, color: '#A855F7' },
    { key: 'steps', label: 'Steps', value: '8,547', unit: '', icon: 'walk' as const, color: '#0284c7' },
    { key: 'distance', label: 'Distance', value: '3.2', unit: 'mi', icon: 'map-marker-distance' as const, color: '#8B5CF6' },
    { key: 'calories', label: 'Calories', value: '1,850', unit: '', icon: 'fire' as const, color: '#FB923C' },
  ] as const;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => setIsExpanded(!isExpanded)}
        style={[styles.mainContent, highlight && styles.highlightBackground]}
      >
        {/* Rank */}
        <View style={styles.rankContainer}>
          <Text style={[styles.rankText, highlight && styles.highlightText]}>
            {rank}
          </Text>
        </View>

        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {avatar_url ? (
            <Image source={{ uri: avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={[styles.avatarLetter, highlight && styles.highlightText]}>
                {display_name?.charAt(0).toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
        </View>

        {/* User Info */}
        <View style={styles.infoContainer}>
          <Text style={[styles.displayName, highlight && styles.highlightText]}>
            {display_name}
          </Text>
          <Text style={[styles.pointsText, highlight && styles.highlightText]}>
            {total_points} pts
          </Text>
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