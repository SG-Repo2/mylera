import { Redirect } from 'expo-router';
import { useAuth } from '../src/providers/AuthProvider';

export default function Index() {
  const { session } = useAuth();

  // Redirect to the appropriate screen based on auth state
  if (session) {
    return <Redirect href="./(app)/metrics" />;
  }

  return <Redirect href="./auth/login" />;
}