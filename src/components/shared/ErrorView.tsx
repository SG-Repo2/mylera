import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import LottieView from 'lottie-react-native';

interface ErrorViewProps {
  error: Error;
  onRetry?: () => void;
}

export const ErrorView: React.FC<ErrorViewProps> = ({ error, onRetry }) => {
  const theme = useTheme();
  const lottieRef = React.useRef<LottieView>(null);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (lottieRef.current) {
      lottieRef.current.play();
    }

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <LottieView
        ref={lottieRef}
        source={require('../../../src/assets/animations/error.json')}
        style={styles.animation}
        autoPlay
        loop
      />

      <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.error }]}>
        Oops! Something went wrong
      </Text>

      <Text variant="bodyMedium" style={styles.message}>
        {error.message}
      </Text>

      {onRetry && (
        <Button
          mode="contained"
          onPress={onRetry}
          style={styles.button}
          buttonColor={theme.colors.primary}
        >
          Try Again
        </Button>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  animation: {
    height: 200,
    marginBottom: 24,
    width: 200,
  },
  button: {
    paddingHorizontal: 24,
  },
  container: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
    padding: 24, // Add solid background color for shadow optimization
  },
  message: {
    marginBottom: 24,
    opacity: 0.7,
    textAlign: 'center',
  },
  title: {
    marginBottom: 12,
    textAlign: 'center',
  },
});
