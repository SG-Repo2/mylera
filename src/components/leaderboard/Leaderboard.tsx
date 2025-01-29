import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RealtimeChannel } from '@supabase/supabase-js';
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
  
  const subscriptionRef = useRef<RealtimeChannel | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const autoRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      
      // Schedule next auto-refresh (every 30 seconds)
      if (autoRefreshTimeoutRef.current) {
        clearTimeout(autoRefreshTimeoutRef.current);
      }
      autoRefreshTimeoutRef.current = setTimeout(() => {
        loadData(false);
      }, 30000);
      
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

  const setupRealtimeSubscription = useCallback(() => {
    if (!user) return;
    
    const today = DateUtils.getLocalDateString();
    
    // Clean up existing subscription if any
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }
    
    // Set up new subscription
    subscriptionRef.current = leaderboardService.subscribeToLeaderboard(
      today,
      (updatedData) => {
        console.log('Received real-time leaderboard update');
        setLeaderboardData(updatedData);
      }
    );
  }, [user]);

  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    if (
      appStateRef.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      console.log('App has come to foreground, refreshing leaderboard');
      loadData(false);
      setupRealtimeSubscription();
    }
    appStateRef.current = nextAppState;
  }, [loadData, setupRealtimeSubscription]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(false);
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    if (user) {
      loadData();
      setupRealtimeSubscription();
      
      // Set up app state listener
      const subscription = AppState.addEventListener('change', handleAppStateChange);
      
      return () => {
        // Clean up
        subscription.remove();
        if (subscriptionRef.current) {
          subscriptionRef.current.unsubscribe();
        }
        if (autoRefreshTimeoutRef.current) {
          clearTimeout(autoRefreshTimeoutRef.current);
        }
      };
    }
  }, [user, loadData, setupRealtimeSubscription, handleAppStateChange]);

  if (loading && !leaderboardData.length && !error) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  if (error) {
    return (
      <ErrorView 
        message={error.message} 
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
          tintColor="#0284c7"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Daily Leaderboard</Text>
        <Text style={styles.subtitle}>
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
                color="#0284c7" 
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
            color="#9CA3AF"
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
    backgroundColor: '#F9FAFB',
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
    paddingTop: 24,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  summaryCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  summaryValue: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantCount: {
    marginLeft: 4,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  bottomPadding: {
    height: 20,
  },
});