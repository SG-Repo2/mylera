import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { leaderboardService } from '@/src/services/leaderboardService';

// Add type for entries
interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  metrics_completed: number;
  rank: number;
}

export function LeaderboardScreen() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        const data = await leaderboardService.getDailyLeaderboard(today);
        setEntries(data);
      } catch (e) {
        console.error('Leaderboard fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  if (loading) return <ActivityIndicator />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today's Leaderboard</Text>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.user_id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.rank}>{item.rank}.</Text>
            <Text style={styles.name}>{item.display_name}</Text>
            <Text style={styles.score}>{item.total_points} pts</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  item: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rank: { fontSize: 16, width: 30 },
  name: { fontSize: 16, flex: 1 },
  score: { fontSize: 16, fontWeight: '600' },
});