import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { getLeaderboard } from '@/services/leaderboardService';

export function LeaderboardScreen() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await getLeaderboard();
        setEntries(data || []);
      } catch (e) {
        console.error('Leaderboard fetch error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <ActivityIndicator />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today's Leaderboard</Text>
      <FlatList
        data={entries}
        keyExtractor={(item, index) => `${item.user_id}-${index}`}
        renderItem={({ item, index }) => {
          const { display_name, avatar_url, show_profile } = item.user_profiles || {};
          const nameToShow = show_profile ? display_name : 'Anonymous';
          return (
            <View style={styles.item}>
              <Text style={styles.rank}>{index + 1}.</Text>
              <Text style={styles.name}>{nameToShow ?? 'Anonymous'}</Text>
              <Text style={styles.score}>{item.total_points} pts</Text>
            </View>
          );
        }}
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