import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../../providers/AuthProvider';
import { ToggleableLeaderboard } from './ToggleableLeaderboard';

/**
 * Wrapper component for the leaderboard that handles authentication state
 * and loading states before rendering the main leaderboard content.
 */
export function Leaderboard() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  if (!user) return null;

  return (
    <View style={styles.container}>
      <ToggleableLeaderboard />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFB',
    flex: 1,
    justifyContent: 'center',
  },
});
