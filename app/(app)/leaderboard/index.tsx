import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../../../src/providers/AuthProvider';
import { Leaderboard } from '../../../src/components/leaderboard/Leaderboard';

/**
 * Leaderboard page component that uses the Leaderboard component.
 * This follows the pattern of keeping route components simple and delegating
 * complex UI logic to dedicated components.
 */
export default function LeaderboardPage() {
  const { user, loading } = useAuth();

  // While Auth context is still verifying session
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  // If no user, let the ProtectedRoutes handle redirection
  if (!user) return null;

  return (
    <View style={styles.container}>
      <Leaderboard />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB', // match Home tab background
    justifyContent: 'center',
  },
});
