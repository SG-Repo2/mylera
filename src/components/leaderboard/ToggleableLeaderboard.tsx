import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  AppState,
  AppStateStatus,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SegmentedButtons } from 'react-native-paper';
import { theme } from '../../theme/theme';
import { leaderboardService } from '../../services/leaderboardService';
import { LeaderboardEntry } from './LeaderboardEntry';
import { PodiumView } from './PodiumView';
import { ErrorView } from '../shared/ErrorView';
import { useAuth } from '../../providers/AuthProvider';
import { DateUtils } from '../../utils/DateUtils';
import type {
  LeaderboardEntry as LeaderboardEntryType,
  LeaderboardTimeframe,
} from '../../types/leaderboard';

export function ToggleableLeaderboard() {
  const { user } = useAuth();
  const [timeframe, setTimeframe] = useState<LeaderboardTimeframe>('daily');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  const loadData = useCallback(
    async (showLoading = true) => {
      if (!user) {
        console.log('No user found in loadData');
        return;
      }

      if (showLoading) setLoading(true);
      setError(null);

      try {
        const today = DateUtils.getLocalDateString();
        console.log('Attempting to fetch leaderboard for:', { timeframe, date: today });

        const data =
          timeframe === 'daily'
            ? await leaderboardService.getDailyLeaderboard(today)
            : await leaderboardService.getWeeklyLeaderboard(today);

        console.log('Fetched leaderboard data:', data);
        setLeaderboardData(data);
      } catch (err) {
        console.error('Error while fetching leaderboard:', err);

        if (err instanceof Error) {
          if (err.message.includes('PGRST200')) {
            setError(
              new Error('Leaderboard data is temporarily unavailable. Please try again later.')
            );
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
    },
    [user, timeframe]
  );

  const handleAppStateChange = useCallback(
    (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App has come to foreground, refreshing leaderboard');
        loadData(false);
      }
      appStateRef.current = nextAppState;
    },
    [loadData]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(false);
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    if (user) {
      loadData();

      const subscription = AppState.addEventListener('change', handleAppStateChange);

      return () => {
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
    return <ErrorView error={error} onRetry={loadData} />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E3A8A" />
      }
    >
      <View style={styles.toggleContainer}>
        <SegmentedButtons
          value={timeframe}
          onValueChange={value => setTimeframe(value as LeaderboardTimeframe)}
          buttons={[
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
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
          <Text style={styles.title}>{timeframe === 'daily' ? 'Daily' : 'Weekly'} Leaderboard</Text>
          {leaderboardData.length > 0 && (
            <View style={styles.participantsContainer}>
              <MaterialCommunityIcons name="account-group" size={24} color="#1E3A8A" />
              <Text style={styles.participantCount}>{leaderboardData.length}</Text>
            </View>
          )}
        </View>
        <Text style={styles.subtitle}>
          {timeframe === 'daily' ? DateUtils.formatDateForDisplay(new Date()) : 'This Week'}
        </Text>
      </View>

      {leaderboardData.length > 0 ? (
        <>
          <PodiumView
            topThree={leaderboardData.slice(0, Math.min(3, leaderboardData.length))}
            currentUserId={user?.id || ''}
          />

          {leaderboardData.length > 3 &&
            leaderboardData
              .slice(3)
              .map(entry => (
                <LeaderboardEntry
                  key={entry.user_id}
                  entry={entry}
                  highlight={entry.user_id === user?.id}
                  variant="standard"
                />
              ))}
        </>
      ) : (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="trophy-outline" size={48} color="#64748B" />
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
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    backgroundColor: '#F0F9FF',
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    marginTop: 12,
    ...theme.fonts.bodyLarge,
    color: '#64748B',
    fontSize: 16,
    textAlign: 'center',
  },
  header: {
    backgroundColor: '#F0F9FF',
    borderBottomColor: '#E2E8F0',
    borderBottomWidth: 1,
    paddingBottom: 16,
    paddingHorizontal: 20,
    paddingTop: Platform.select({
      android: DYNAMIC_PADDING,
      ios: DYNAMIC_PADDING,
    }),
  },
  headerTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 4,
  },
  participantCount: {
    marginLeft: 6,
    ...theme.fonts.bodyLarge,
    color: '#1E3A8A',
    fontWeight: '600',
  },
  participantsContainer: {
    alignItems: 'center',
    backgroundColor: '#E0E7FF',
    borderRadius: 16,
    flexDirection: 'row',
    marginLeft: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  subtitle: {
    ...theme.fonts.bodyLarge,
    color: '#64748B',
    fontSize: 16,
    marginTop: 4,
    textAlign: 'center',
  },
  title: {
    ...theme.fonts.titleLarge,
    color: '#1E3A8A',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  toggle: {
    marginBottom: 8,
  },
  toggleContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
});
