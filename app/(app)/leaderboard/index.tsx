import React from 'react';
import { Leaderboard } from '../../../src/components/leaderboard/Leaderboard';
import { useAuth } from '../../../src/providers/AuthProvider';

export default function LeaderboardPage() {
  const { user } = useAuth();
  
  if (!user) return null;
  
  return <Leaderboard />;
}