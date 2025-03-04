import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { theme } from '../../theme/theme';
import { LeaderboardEntry } from './LeaderboardEntry';
import type { LeaderboardEntry as LeaderboardEntryType } from '../../types/leaderboard';

interface PodiumProps {
  topThree: LeaderboardEntryType[];
  currentUserId: string;
}

/**
 * Displays the top three leaderboard entries in a podium layout.
 * First place is centered and elevated, with second and third place on either side.
 */
export function PodiumView({ topThree, currentUserId }: PodiumProps) {
  // Only include entries that actually exist
  const podiumEntries = [
    topThree[1] ? { entry: topThree[1], rank: 2 } : null, // Second place
    topThree[0] ? { entry: topThree[0], rank: 1 } : null, // First place
    topThree[2] ? { entry: topThree[2], rank: 3 } : null  // Third place
  ].filter(Boolean) as { entry: LeaderboardEntryType, rank: number }[];
  
  // If no entries, don't render the podium
  if (podiumEntries.length === 0) {
    return null;
  }
  
  return (
    <View style={styles.outerContainer}>
      <View style={styles.podiumContainer}>
        {podiumEntries.map(({ entry, rank }) => (
          <View
            key={entry.user_id}
            style={[
              styles.podiumItem,
              rank === 1 && styles.firstPlace,
              rank === 2 && styles.secondPlace,
              rank === 3 && styles.thirdPlace,
            ]}
          >
            <View style={[
              styles.podiumEntryWrapper,
              // Add solid background color to fix shadow issue
              { backgroundColor: '#FFFFFF' }
            ]}>
              <LeaderboardEntry
                entry={entry}
                highlight={entry.user_id === currentUserId}
                variant="podium"
                position={rank}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    marginHorizontal: 16,
    marginVertical: 20,
    backgroundColor: '#1E3A8A',
    borderRadius: theme.roundness * 2,
    // Add overflow: 'hidden' to contain shadows
    overflow: 'hidden',
    zIndex: 20, // Higher than Avatar's z-index of 10
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  podiumContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: 12,
    paddingBottom: 18,
  },
  podiumItem: {
    flex: 1,
    marginHorizontal: 4,
    minHeight: 120,
    maxHeight: 160,
  },
  podiumEntryWrapper: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
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
  firstPlace: {
    transform: [{ translateY: -20 }],
    zIndex: 23, // Higher than outerContainer
  },
  secondPlace: {
    transform: [{ translateY: -10 }],
    zIndex: 22, // Higher than outerContainer
  },
  thirdPlace: {
    zIndex: 21, // Higher than outerContainer
  },
});
