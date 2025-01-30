import { useState, useEffect } from 'react';
import { metricsService } from '../services/metricsService';

export const useLeaderboard = (date: string) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const data = await metricsService.getDailyTotals(date);
        setLeaderboard(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch leaderboard'));
        console.error('Leaderboard error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
    // Refresh every minute
    const interval = setInterval(fetchLeaderboard, 60 * 1000);
    return () => clearInterval(interval);
  }, [date]);

  return {
    loading,
    error,
    leaderboard
  };
}; 