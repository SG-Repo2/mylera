// src/components/shared/ErrorView.tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface ErrorViewProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorView({ message, onRetry }: ErrorViewProps) {
  return (
    <View className="flex-1 items-center justify-center p-4">
      <MaterialIcons 
        name="error-outline" 
        size={48} 
        color="#EF4444" 
        style={{ marginBottom: 16 }}
      />
      <Text className="text-gray-900 text-lg font-medium text-center mb-2">
        Oops! Something went wrong
      </Text>
      <Text className="text-gray-600 text-center mb-6">
        {message}
      </Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          className="flex-row items-center space-x-2 bg-primary px-6 py-3 rounded-xl"
        >
          <MaterialIcons name="refresh" size={20} color="white" />
          <Text className="text-white font-medium">Try Again</Text>
        </Pressable>
      )}
    </View>
  );
}