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
  
  // Track app state for background/foreground transitions
  const appStateRef = useRef(AppState.currentState);
  
  // Cache leaderboard data to avoid unnecessary fetches
  const leaderboardCache = useRef<{
    daily: { date: string; data: LeaderboardEntryType[] } | null;
    weekly: { date: string; data: LeaderboardEntryType[] } | null;
  }>({
    daily: null,
    weekly: null
  });
  
  // Subscription reference for cleanup
  const subscriptionRef = useRef<any>(null);

  // Get today's date once
  const today = DateUtils.getLocalDateString();
  
  /**
   * Load leaderboard data with error handling and caching
   */
  const loadData = useCallback(async (showLoading = true) => {
    if (!user) {
      console.log('No user found in loadData');
      return;
    }
    
    if (showLoading) setLoading(true);
    setError(null);
    
    try {
      console.log('Attempting to fetch leaderboard for:', { timeframe, date: today });
      
      // Check cache first
      const cache = leaderboardCache.current[timeframe];
      if (cache && cache.date === today && cache.data.length > 0) {
        console.log(`Using cached ${timeframe} leaderboard data`);
        setLeaderboardData(cache.data);
        if (showLoading) setLoading(false);
        return;
      }
      
      // Fetch new data
      const data = timeframe === 'daily' 
        ? await leaderboardService.getDailyLeaderboard(today)
        : await leaderboardService.getWeeklyLeaderboard(today);
        
      // Log data for debugging
      console.log(`Fetched ${data.length} ${timeframe} leaderboard entries`);
      
      if (data.length > 0) {
        // Update cache
        leaderboardCache.current[timeframe] = { date: today, data };
      }
      
      setLeaderboardData(data);
    } catch (err) {
      console.error('Error while fetching leaderboard:', err);
      
      // Provide user-friendly error messages
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
      
      // Use cached data if available
      const cache = leaderboardCache.current[timeframe];
      if (cache && cache.data.length > 0) {
        console.log(`Using cached ${timeframe} leaderboard data after error`);
        setLeaderboardData(cache.data);
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [user, timeframe, today]);

  // Handle app state changes (background/foreground)
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

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Clear cache to force fresh data
    leaderboardCache.current[timeframe] = null;
    await loadData(false);
    setRefreshing(false);
  }, [loadData, timeframe]);

  // Setup real-time subscription
  useEffect(() => {
    if (user) {
      // Clean up previous subscription if it exists
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      
      // Set up new subscription for current timeframe
      subscriptionRef.current = leaderboardService.subscribeToLeaderboard(
        today,
        timeframe,
        (updatedEntries) => {
          console.log(`Received leaderboard update with ${updatedEntries.length} entries`);
          setLeaderboardData(updatedEntries);
          // Update cache
          leaderboardCache.current[timeframe] = { date: today, data: updatedEntries };
        }
      );
      
      // Initial data load
      loadData();
      
      // Set up app state listener
      const subscription = AppState.addEventListener('change', handleAppStateChange);
      
      return () => {
        // Clean up subscription and listener
        if (subscriptionRef.current) {
          subscriptionRef.current.unsubscribe();
        }
        subscription.remove();
      };
    }
  }, [user, loadData, handleAppStateChange, timeframe, today]);

  // Handle timeframe change
  const handleTimeframeChange = (value: string) => {
    setTimeframe(value as LeaderboardTimeframe);
  };

  if (loading && !leaderboardData.length && !error) {
    return (
      <View style={styles.centered} testID="leaderboard-loading">
        <ActivityIndicator size="large" color="#1E3A8A" />
      </View>
    );
  }

  if (error && !leaderboardData.length) {
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
            {error 
              ? "Couldn't load leaderboard data. Pull down to retry."
              : `No leaderboard data available for ${timeframe === 'daily' ? 'today' : 'this week'}.`
            }
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
    paddingHorizontal: 20,
  },
  emptyStateText: {
    marginTop: 12,
    ...theme.fonts.bodyLarge,
    color: '#64748B',
    textAlign: 'center',
    fontSize: 16,
  },
});
