import React from 'react';
import { View, Text, Image } from 'react-native';
import type { LeaderboardEntry as LeaderboardEntryType } from '../../types/leaderboard';

interface Props {
  entry: LeaderboardEntryType;
  highlight?: boolean;
}

/**
 * Displays individual leaderboard row.
 * 
 * If `highlight` is true (e.g., current user's row), apply accent styles.
 */
export function LeaderboardEntry({ entry, highlight }: Props) {
  const { display_name, avatar_url, total_points, metrics_completed, rank } = entry;
  
  return (
    <View className={`flex-row items-center bg-white mx-4 my-2 p-4 rounded-xl shadow-sm ${highlight ? 'bg-sky-50' : ''}`}>
      {/* Rank */}
      <View className="mr-3 w-8 items-center">
        <Text className={`text-xl font-bold ${highlight ? 'text-sky-600' : 'text-gray-700'}`}>
          {rank}
        </Text>
      </View>

      {/* Avatar */}
      <View className="mr-3">
        {avatar_url ? (
          <Image 
            source={{ uri: avatar_url }} 
            className="w-12 h-12 rounded-full"
          />
        ) : (
          <View className="w-12 h-12 rounded-full bg-gray-300 items-center justify-center">
            <Text className={`text-lg font-bold ${highlight ? 'text-sky-600' : 'text-white'}`}>
              {display_name?.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
        )}
      </View>

      {/* User Info */}
      <View className="flex-1">
        <Text className={`text-base font-semibold ${highlight ? 'text-sky-600' : 'text-gray-900'}`}>
          {display_name}
        </Text>
        <Text className={`text-sm ${highlight ? 'text-sky-600' : 'text-gray-800'}`}>
          {total_points} pts
        </Text>
        <Text className={`text-sm ${highlight ? 'text-sky-500/80' : 'text-gray-500'}`}>
          {metrics_completed} metrics
        </Text>
      </View>
    </View>
  );
}