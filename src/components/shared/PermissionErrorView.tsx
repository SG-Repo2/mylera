import React from 'react';
import { View, Text, Linking, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ErrorView } from './ErrorView';
import { useAuth } from '../../providers/AuthProvider';

interface PermissionErrorViewProps {
  onRetry?: () => void;
}

export function PermissionErrorView({ onRetry }: PermissionErrorViewProps) {
  const { requestHealthPermissions } = useAuth();

  const handleRetry = async () => {
    if (onRetry) {
      onRetry();
    } else {
      await requestHealthPermissions();
    }
  };

  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  return (
    <View className="flex-1">
      <ErrorView
        message="Health data access is required to track your metrics. Please grant permission to continue."
        onRetry={handleRetry}
      />
      <View className="px-4 pb-6">
        <Text 
          className="text-primary text-center underline"
          onPress={openSettings}
        >
          Open Settings
        </Text>
        <Text className="text-gray-500 text-sm text-center mt-2">
          You can also enable permissions in your device settings
        </Text>
      </View>
    </View>
  );
}