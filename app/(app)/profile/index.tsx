import React from 'react';
import { Profile } from '../../../src/components/profile/Profile';
import { useAuth } from '../../../src/providers/AuthProvider';

export default function ProfilePage() {
  const { user } = useAuth();
  
  if (!user) return null;
  
  return <Profile />;
}