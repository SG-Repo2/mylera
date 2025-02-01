import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../../theme/theme';
import { leaderboardService } from '../../services/leaderboardService';
import { LeaderboardEntry } from './LeaderboardEntry';
import { PodiumView } from './PodiumView';
import { ErrorView } from '../shared/ErrorView';
import { useAuth } from '../../providers/AuthProvider';
import { DateUtils } from '../../utils/DateUtils';
import type { LeaderboardEntry as LeaderboardEntryType } from '../../types/leaderboard';

/**
 * Displays the daily leaderboard with pull-to-refresh functionality.
 * Top 3 entries are shown in a podium layout when available.
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
        <ActivityIndicator size="large" color="#1E3A8A" />
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
          tintColor="#1E3A8A"
        />
      }
    >
      {/* Header */}
      <View 
        style={styles.header}
        accessibilityRole="header"
        accessibilityLabel="Daily Leaderboard"
      >
        <View style={styles.headerTop}>
          <Text style={styles.title}>Daily Leaderboard</Text>
          {leaderboardData.length > 0 && (
            <View style={styles.participantsContainer}>
              <MaterialCommunityIcons 
                name="account-group" 
                size={24} 
                color="#1E3A8A"
              />
              <Text style={styles.participantCount}>
                {leaderboardData.length}
              </Text>
            </View>
          )}
        </View>
        <Text 
          style={styles.subtitle}
          accessibilityLabel={`For ${DateUtils.formatDateForDisplay(new Date())}`}
        >
          {DateUtils.formatDateForDisplay(new Date())}
        </Text>
      </View>

      {/* Podium View for Top 3 */}
      {leaderboardData.length >= 3 && (
        <PodiumView 
          topThree={leaderboardData.slice(0, 3)}
          currentUserId={user?.id || ''}
        />
      )}

      {/* Standard List for Remaining Entries */}
      {leaderboardData.length > 3 && leaderboardData.slice(3).map((entry) => (
        <LeaderboardEntry 
          key={entry.user_id} 
          entry={entry}
          highlight={entry.user_id === user?.id}
          variant="standard"
        />
      ))}

      {/* Empty State */}
      {!loading && leaderboardData.length === 0 && (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons 
            name="trophy-outline" 
            size={48} 
            color="#64748B"
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
    backgroundColor: '#F0F9FF',
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#F0F9FF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    ...theme.fonts.titleLarge,
    color: '#1E3A8A',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 28,
  },
  subtitle: {
    ...theme.fonts.bodyLarge,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
    fontSize: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  participantsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  participantCount: {
    marginLeft: 6,
    ...theme.fonts.bodyLarge,
    color: '#1E3A8A',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    marginTop: 12,
    ...theme.fonts.bodyLarge,
    color: '#64748B',
    textAlign: 'center',
    fontSize: 16,
  },
  bottomPadding: {
    height: 32,
  },
});
