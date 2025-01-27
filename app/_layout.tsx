// app/_layout.tsx
import { Stack, useSegments, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../src/providers/AuthProvider';

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigation />
    </AuthProvider>
  );
}

// Responsible for redirecting based on session
function RootNavigation() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return; // wait until session is loaded

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // Not signed in -> push to login
      router.replace('/login');
    } else if (session && inAuthGroup) {
      // Already signed in -> push to protected routes
      router.replace('/(app)');
    }
  }, [session, loading, segments]);

  return (
    <Stack>
      {/* Auth stack */}
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      {/* Protected app stack */}
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
      {/* 
        Optional: If you want a top-level `index.tsx`, 
        you can also add <Stack.Screen name="index" .../> 
      */}
    </Stack>
  );
}