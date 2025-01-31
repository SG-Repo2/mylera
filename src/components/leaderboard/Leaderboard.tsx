import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
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
  const [refreshing, setRefreshing] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  const loadData = useCallback(async (showLoading = true) => {
    if (!user) {
      console.log('No user found in loadData');
      return;
    }
    
    if (showLoading) setLoading(true);
    setError(null);
    
    try {
      const today = DateUtils.getLocalDateString();
      console.log('Attempting to fetch leaderboard for date:', today);
      
      const data = await leaderboardService.getDailyLeaderboard(today);
      console.log('Fetched leaderboard data:', data);
      setLeaderboardData(data);
    } catch (err) {
      console.error('Error while fetching leaderboard:', err);
      
      if (err instanceof Error) {
        if (err.message.includes('PGRST200')) {
          setError(new Error('Leaderboard data is temporarily unavailable. Please try again later.'));
        } else if (err.message.includes('42501')) {
          setError(new Error('You do not have permission to view the leaderboard.'));
        } else {
          setError(err);
        }
      } else {
        setError(new Error('Failed to load leaderboard'));
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [user]);

  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    if (
      appStateRef.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      console.log('App has come to foreground, refreshing leaderboard');
      loadData(false);
    }
    appStateRef.current = nextAppState;
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(false);
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    if (user) {
      loadData();
      
      // Set up app state listener
      const subscription = AppState.addEventListener('change', handleAppStateChange);
      
      return () => {
      // Clean up
      subscription.remove();
      };
    }
  }, [user, loadData, handleAppStateChange]);

  if (loading && !leaderboardData.length && !error) {
    return (
      <View style={styles.centered} testID="leaderboard-loading">
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <ErrorView 
        error={error} 
        onRetry={loadData}
      />
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.primary}
        />
      }
    >
      {/* Header */}
      <View 
        style={styles.header}
        accessibilityRole="header"
        accessibilityLabel="Daily Leaderboard"
      >
        <Text style={styles.title}>Daily Leaderboard</Text>
        <Text 
          style={styles.subtitle}
          accessibilityLabel={`For ${DateUtils.formatDateForDisplay(new Date())}`}
        >
          {DateUtils.formatDateForDisplay(new Date())}
        </Text>
      </View>

      {/* Total Points Summary */}
      {leaderboardData.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Participants</Text>
            <View style={styles.summaryValue}>
              <MaterialCommunityIcons 
                name="account-group" 
                size={24} 
                color={theme.colors.primary}
              />
              <Text style={styles.participantCount}>
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
        <View style={styles.emptyState}>
          <MaterialCommunityIcons 
            name="trophy-outline" 
            size={48} 
            color={theme.colors.onSurfaceVariant}
          />
          <Text style={styles.emptyStateText}>
            No leaderboard data available for today.
          </Text>
        </View>
      )}

      {/* Bottom Padding */}
      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 20,
    backgroundColor: theme.colors.surface,
    borderBottomLeftRadius: theme.roundness * 3,
    borderBottomRightRadius: theme.roundness * 3,
    elevation: 2,
    shadowColor: theme.colors.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  title: {
    ...theme.fonts.headlineMedium,
    color: theme.colors.onSurface,
    textAlign: 'center',
  },
  subtitle: {
    ...theme.fonts.bodyLarge,
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
    textAlign: 'center',
  },
  summaryCard: {
    marginHorizontal: 16,
    marginTop: -16,
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness * 2,
    padding: 16,
    elevation: 3,
    shadowColor: theme.colors.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    ...theme.fonts.titleMedium,
    color: theme.colors.onSurface,
  },
  summaryValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantCount: {
    marginLeft: 8,
    ...theme.fonts.headlineSmall,
    color: theme.colors.primary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    marginTop: 8,
    ...theme.fonts.bodyMedium,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
  },
  bottomPadding: {
    height: 20,
  },
});
