import React, { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';
import { leaderboardService } from '../../src/services/leaderboardService';

interface LeaderboardUser {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  metrics_completed: number;
  rank: number;
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async () => {
    if (!session?.user) return;

    try {
      setLoading(true);
      setError(null);
      const today = new Date().toISOString().split('T')[0];
      const data = await leaderboardService.getDailyLeaderboard(today);
      setLeaderboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [session?.user]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#20B2AA" />
          <Text className="text-text-secondary mt-2">Loading leaderboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 justify-center items-center p-4">
          <Text className="text-status-error text-lg mb-2">Something went wrong</Text>
          <Text className="text-text-secondary text-center mb-4">{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1">
        <View className="p-4">
          <Text className="text-2xl font-bold text-text-primary mb-4">
            Today's Leaders
          </Text>

          <View className="space-y-2">
            {leaderboard.map((user) => (
              <View 
                key={user.user_id}
                className={`
                  flex-row items-center p-4 rounded-lg
                  ${user.user_id === session?.user?.id ? 'bg-primary/10' : 'bg-white'}
                `}
              >
                {/* Rank Circle */}
                <View className="w-10 h-10 rounded-full bg-gray-200 justify-center items-center">
                  {user.avatar_url ? (
                    <Image
                      source={{ uri: user.avatar_url }}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <Text className="text-text-secondary font-semibold">
                      #{user.rank}
                    </Text>
                  )}
                </View>

                {/* User Info */}
                <View className="flex-1 ml-4">
                  <Text 
                    className={`
                      font-semibold text-lg
                      ${user.user_id === session?.user?.id ? 'text-primary' : 'text-text-primary'}
                    `}
                  >
                    {user.display_name}
                  </Text>
                  <View className="flex-row items-center">
                    <Text className="text-text-secondary">
                      {user.total_points} points
                    </Text>
                    <Text className="text-text-secondary mx-2">•</Text>
                    <Text className="text-text-secondary">
                      {user.metrics_completed} goals completed
                    </Text>
                  </View>
                </View>

                {/* Current User Indicator */}
                {user.user_id === session?.user?.id && (
                  <View className="bg-primary/20 px-2 py-1 rounded">
                    <Text className="text-primary text-sm font-medium">
                      You
                    </Text>
                  </View>
                )}
              </View>
            ))}

            {leaderboard.length === 0 && (
              <View className="bg-white p-4 rounded-lg">
                <Text className="text-text-secondary text-center">
                  No leaderboard data available yet
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}