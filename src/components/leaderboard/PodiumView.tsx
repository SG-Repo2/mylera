import React from 'react';
import { View } from 'react-native';
import { LeaderboardEntry } from './LeaderboardEntry';
import type { LeaderboardEntry as LeaderboardEntryType } from '../../types/leaderboard';
import { podiumViewStyles } from '../../styles/podiumViewStyles';

interface PodiumProps {
  topThree: LeaderboardEntryType[];
  currentUserId: string;
}

/**
 * Displays the top three leaderboard entries in a podium layout.
 * First place is centered and elevated, with second and third place on either side.
 */
export function PodiumView({ topThree, currentUserId }: PodiumProps) {
  // Create podium order with null entries for missing positions
  const podiumOrder = [
    { entry: topThree[1] || null, rank: 2 }, // Second place
    { entry: topThree[0] || null, rank: 1 }, // First place
    { entry: topThree[2] || null, rank: 3 }, // Third place
  ].filter(item => item.entry !== null); // Filter out null entries

  return (
    <View style={podiumViewStyles.outerContainer}>
      <View style={podiumViewStyles.podiumContainer}>
        {podiumOrder.map(({ entry, rank }) => (
          <View
            key={entry.user_id}
            style={[
              podiumViewStyles.podiumItem,
              rank === 1 && podiumViewStyles.firstPlace,
              rank === 2 && podiumViewStyles.secondPlace,
              rank === 3 && podiumViewStyles.thirdPlace,
            ]}
          >
            <View style={podiumViewStyles.podiumEntryWrapper}>
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
