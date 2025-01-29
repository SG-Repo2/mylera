import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { leaderboardService } from '../../services/leaderboardService';
import { LeaderboardEntry } from './LeaderboardEntry';
import { ErrorView } from '../shared/ErrorView';
import { useAuth } from '../../providers/AuthProvider';
import { DateUtils } from '../../utils/DateUtils';
import type { LeaderboardEntry as LeaderboardEntryType } from '../../types/leaderboard';

/**
 * Displays the daily leaderboard with pull-to-refresh functionality.
 * Highlights the current user's entry if present.
 */
export function Leaderboard() {
  const { user } = useAuth();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    try {
      const today = DateUtils.getLocalDateString();
      const data = await leaderboardService.getDailyLeaderboard(today);
      setLeaderboardData(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load leaderboard'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  if (loading && !leaderboardData.length && !error) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" className="text-sky-600" />
      </View>
    );
  }

  if (error) {
    return (
      <ErrorView 
        message={error.message} 
        onRetry={loadData}
      />
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl 
          refreshing={loading}
          onRefresh={loadData}
          tintColor="#0284c7"
        />
      }
    >
      {/* Header */}
      <View className="px-5 pt-8 pb-4">
        <Text className="text-2xl font-bold text-gray-900">
          Daily Leaderboard
        </Text>
        <Text className="text-base text-gray-500 mt-1">
          {DateUtils.formatDateForDisplay(new Date())}
        </Text>
      </View>

      {/* Total Points Summary */}
      {leaderboardData.length > 0 && (
        <View className="mx-4 mb-4 p-4 bg-white rounded-xl shadow-sm">
          <View className="flex-row justify-between items-center">
            <Text className="text-lg font-semibold text-gray-800">
              Total Participants
            </Text>
            <View className="flex-row items-center space-x-2">
              <MaterialCommunityIcons name="account-group" size={24} color="#0284c7" />
              <Text className="text-xl font-bold text-gray-900">
                {leaderboardData.length}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Leaderboard Entries */}
      {leaderboardData.map((entry) => (
        <LeaderboardEntry 
          key={entry.user_id} 
          entry={entry}
          highlight={entry.user_id === user?.id}
        />
      ))}

      {/* Empty State */}
      {!loading && leaderboardData.length === 0 && (
        <View className="flex-1 items-center justify-center p-5">
          <MaterialCommunityIcons 
            name="trophy-outline" 
            size={48} 
            color="#9CA3AF"
          />
          <Text className="text-base text-gray-500 text-center mt-4">
            No leaderboard data available for today.
          </Text>
        </View>
      )}

      {/* Bottom Padding */}
      <View className="h-5" />
    </ScrollView>
  );
}