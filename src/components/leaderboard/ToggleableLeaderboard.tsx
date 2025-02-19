import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, StyleSheet, AppState, AppStateStatus, Platform, StatusBar, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SegmentedButtons } from 'react-native-paper';
import { theme } from '../../theme/theme';
import { leaderboardService } from '../../services/leaderboardService';
import { LeaderboardEntry } from './LeaderboardEntry';
import { PodiumView } from './PodiumView';
import { ErrorView } from '../shared/ErrorView';
import { useAuth } from '../../providers/AuthProvider';
import { DateUtils } from '../../utils/DateUtils';
import type { LeaderboardEntry as LeaderboardEntryType, LeaderboardTimeframe } from '../../types/leaderboard';

export function ToggleableLeaderboard() {
  const { user } = useAuth();
  const [timeframe, setTimeframe] = useState<LeaderboardTimeframe>('daily');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const subscriptionRef = useRef<ReturnType<typeof leaderboardService.subscribeToLeaderboard> | null>(null);
  const todayRef = useRef(DateUtils.getLocalDateString());

  const handleLeaderboardUpdate = useCallback((entries: LeaderboardEntryType[]) => {
    console.log('[ToggleableLeaderboard] Received leaderboard update:', entries.length);
    
    const sortedEntries = entries.sort((a, b) => {
      if (b.total_points !== a.total_points) {
        return b.total_points - a.total_points;
      }
      return b.metrics_completed - a.metrics_completed;
    });

    setLeaderboardData(prevData => {
      if (prevData.length !== sortedEntries.length) {
        return sortedEntries;
      }

      for (let i = 0; i < prevData.length; i++) {
        if (prevData[i].total_points !== sortedEntries[i].total_points ||
            prevData[i].metrics_completed !== sortedEntries[i].metrics_completed) {
          return sortedEntries;
        }
      }
      
      return prevData;
    });
    
    if (loading) {
      setLoading(false);
    }
  }, [loading]);

  const loadData = useCallback(async (showLoading = true) => {
    if (!user) return;
    
    if (showLoading && !leaderboardData.length) {
      setLoading(true);
    }
    
    setError(null);
    
    try {
      const today = todayRef.current;
      
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      
      subscriptionRef.current = leaderboardService.subscribeToLeaderboard(
        today,
        timeframe,
        handleLeaderboardUpdate
      );
      
      const data = timeframe === 'daily' 
        ? await leaderboardService.getDailyLeaderboard(today)
        : await leaderboardService.getWeeklyLeaderboard(today);
        
      handleLeaderboardUpdate(data);
    } catch (err) {
      console.error('[ToggleableLeaderboard] Error fetching leaderboard:', err);
      setError(err instanceof Error ? err : new Error('Failed to load leaderboard'));
      if (showLoading) setLoading(false);
    }
  }, [user, timeframe, handleLeaderboardUpdate]);

  useEffect(() => {
    if (user) {
      loadData();
    }
    
    return () => {
      if (subscriptionRef.current) {
        console.log('[ToggleableLeaderboard] Cleaning up subscription on unmount');
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [user, timeframe]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('App has come to foreground, refreshing leaderboard');
        loadData(false);
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(false);
    setRefreshing(false);
  }, [loadData]);

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
      <View style={styles.toggleContainer}>
        <SegmentedButtons
          value={timeframe}
          onValueChange={(value) => setTimeframe(value as LeaderboardTimeframe)}
          buttons={[
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' }
          ]}
          style={styles.toggle}
        />
      </View>

      {/* Header */}
      <View 
        style={styles.header}
        accessibilityRole="header"
        accessibilityLabel={`${timeframe === 'daily' ? 'Daily' : 'Weekly'} Leaderboard`}
      >
        <View style={styles.headerTop}>
          <Text style={styles.title}>
            {timeframe === 'daily' ? 'Daily' : 'Weekly'} Leaderboard
          </Text>
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
        <Text style={styles.subtitle}>
          {timeframe === 'daily' 
            ? DateUtils.formatDateForDisplay(new Date())
            : 'This Week'
          }
        </Text>
      </View>

      {leaderboardData.length > 0 ? (
        <>
          <PodiumView 
            topThree={leaderboardData.slice(0, Math.min(3, leaderboardData.length))}
            currentUserId={user?.id || ''}
          />
          
          {leaderboardData.length > 3 && (
            leaderboardData.slice(3).map((entry) => (
              <LeaderboardEntry 
                key={entry.user_id} 
                entry={entry}
                highlight={entry.user_id === user?.id}
                variant="standard"
              />
            ))
          )}
        </>
      ) : (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons 
            name="trophy-outline" 
            size={48} 
            color="#64748B"
          />
          <Text style={styles.emptyStateText}>
            No leaderboard data available for {timeframe === 'daily' ? 'today' : 'this week'}.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const DYNAMIC_PADDING = Math.min(20, SCREEN_HEIGHT * 0.025);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F9FF',
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  toggleContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  toggle: {
    marginBottom: 8,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.select({
      android: DYNAMIC_PADDING,
      ios: DYNAMIC_PADDING
    }),
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
});
