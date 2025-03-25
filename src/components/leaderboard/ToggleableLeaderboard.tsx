import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, StyleSheet, AppState, AppStateStatus, Platform, StatusBar, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SegmentedButtons } from 'react-native-paper';
import { theme } from '../../theme/theme';
import { leaderboardService } from '../../services/leaderboardService';
import { LeaderboardEntry } from './LeaderboardEntry';
import { PodiumView } from './PodiumView';
import { ErrorView } from '../shared/ErrorView';
import { useAuth } from '../../providers/auth';
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
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [cachedData, setCachedData] = useState<{
    daily: LeaderboardEntryType[];
    weekly: LeaderboardEntryType[];
  }>({ daily: [], weekly: [] });

  const loadData = useCallback(async (showLoading = true) => {
    if (!user || !isMountedRef.current) {
      console.log('No user found in loadData or component unmounted');
      return;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Use cached data if available
    if (cachedData[timeframe].length > 0) {
      setLeaderboardData(cachedData[timeframe]);
      if (showLoading && isMountedRef.current) setLoading(false);
    } else if (showLoading && isMountedRef.current) {
      setLoading(true);
    }
    
    if (isMountedRef.current) setError(null);
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    try {
      const today = DateUtils.getLocalDateString();
      
      const data = timeframe === 'daily' 
        ? await leaderboardService.getDailyLeaderboard(today)
        : await leaderboardService.getWeeklyLeaderboard(today);
        
      if (!isMountedRef.current) return;
      
      setLeaderboardData(data);
      setCachedData(prev => ({
        ...prev,
        [timeframe]: data
      }));
    } catch (err) {
      // ...existing error handling...
      if (!isMountedRef.current) return;
      
      // Don't treat aborted requests as errors
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.log('Leaderboard request was aborted');
        return;
      }
      
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
      if (showLoading && isMountedRef.current) setLoading(false);
    }
  }, [user, timeframe, cachedData]);

  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    if (
      appStateRef.current.match(/inactive|background/) &&
      nextAppState === 'active' &&
      isMountedRef.current
    ) {
      console.log('App has come to foreground, refreshing leaderboard');
      loadData(false);
    }
    appStateRef.current = nextAppState;
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    setRefreshing(true);
    
    try {
      await loadData(false);
    } catch (error) {
      console.error("Error during refresh:", error);
    } finally {
      if (isMountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [loadData]);

  useEffect(() => {
    // Set mounted flag
    isMountedRef.current = true;
    
    if (user) {
      loadData();
      
      const subscription = AppState.addEventListener('change', handleAppStateChange);
      
      return () => {
        // Set unmounted flag
        isMountedRef.current = false;
        
        // Cancel any in-progress requests
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }
        
        // Remove app state listener
        subscription.remove();
      };
    }
  }, [user, loadData, handleAppStateChange, timeframe]);

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
          colors={["#1E3A8A"]}
          progressBackgroundColor="#F0F9FF"
        />
      }
    >
      <View style={styles.toggleContainer}>
        <SegmentedButtons
          value={timeframe}
          onValueChange={(value) => {
            const newTimeframe = value as LeaderboardTimeframe;
            setTimeframe(newTimeframe);
            // Load data only if cache is empty
            if (cachedData[newTimeframe].length === 0) {
              loadData(true);
            } else {
              setLeaderboardData(cachedData[newTimeframe]);
            }
          }}
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