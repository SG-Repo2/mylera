import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme/theme';
import { Platform } from 'react-native';

// Define screen-specific transitions
const getTabScreenOptions = (routeName: string) => ({
  headerShown: false,
  tabBarStyle: {
    backgroundColor: theme.colors.surface,
    borderTopColor: 'rgba(0,0,0,0.1)',
    height: 60,
    paddingBottom: 8,
    paddingTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  tabBarActiveTintColor: theme.colors.primary,
  tabBarInactiveTintColor: theme.colors.outline,
  tabBarLabelStyle: {
    fontFamily: 'Proxima Nova',
    fontSize: 12,
  },
  // Add subtle animation when tab changes
  tabBarPressColor: theme.colors.primaryContainer,
  tabBarPressOpacity: 0.8,
});

export default function AppLayout() {
  return (
    <Tabs screenOptions={({ route }) => getTabScreenOptions(route.name)}>
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-sharp" color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaderboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart" color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-sharp" color={color} size={24} />
          ),
        }}
      />
    </Tabs>
  );
}