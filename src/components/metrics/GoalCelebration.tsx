import React, { useEffect, useRef } from 'react';
import { Modal, View, Animated, Share, Platform } from 'react-native';
import { Surface, Text, useTheme, Button } from 'react-native-paper';
import { FontAwesome } from '@expo/vector-icons';
import { useStyles } from '@/src/styles/GoalCelebration.styles';

interface GoalCelebrationProps {
  visible: boolean;
  onClose: () => void;
  bonusPoints: number;
}

const GoalCelebration: React.FC<GoalCelebrationProps> = ({
  visible,
  onClose,
  bonusPoints,
}) => {
  const styles = useStyles();
  const theme = useTheme();

  // Use useRef so animated values persist across renders.
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset animation values when the modal becomes visible.
      scaleAnim.setValue(0.5);
      opacityAnim.setValue(0);

      // Start entrance animations in parallel.
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          damping: 15,
          stiffness: 150,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scaleAnim, opacityAnim]);

  if (!visible) return null;

  // Handle sharing via different platforms.
  const handleShare = async (platform: string) => {
    const message =
      "I just reached my daily step goal! 🎉 Join me on my fitness journey!";
    const url = "https://yourapp.com/signup";

    try {
      if (Platform.OS === 'web') {
        const shareUrls: Record<string, string> = {
          facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
            url
          )}&quote=${encodeURIComponent(message)}`,
          twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
            message
          )}&url=${encodeURIComponent(url)}`,
          instagram: 'https://instagram.com',
          whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(
            message
          )} ${encodeURIComponent(url)}`,
        };
        const shareUrl = shareUrls[platform];
        if (shareUrl) {
          window.open(shareUrl, '_blank');
        }
      } else {
        await Share.share({
          message: `${message}\n${url}`,
          url, // iOS only
          title: 'Share Goal Achievement',
        });
      }

      // Exit animation: enlarge and fade out before closing.
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1.2,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => onClose());
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  // Define the share buttons using platform branding colors.
  const shareButtons = [
    { platform: 'facebook', color: '#1877F2', icon: 'facebook' as const },
    { platform: 'twitter', color: '#1DA1F2', icon: 'twitter' as const },
    { platform: 'instagram', color: '#E4405F', icon: 'instagram' as const },
    { platform: 'whatsapp', color: '#25D366', icon: 'whatsapp' as const },
  ] as const;

  return (
    <Modal transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.backdrop} onTouchEnd={onClose} />
        <Animated.View
          style={[
            styles.contentContainer,
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          <Surface
            style={[
              styles.surface,
              {
                backgroundColor: theme.dark
                  ? theme.colors.surfaceVariant
                  : theme.colors.surface,
              },
            ]}
          >
            {/* Stars Section */}
            <View style={styles.starsContainer}>
              {[...Array(3)].map((_, i) => (
                <View key={i} style={[styles.starContainer, { marginHorizontal: 4 }]}>
                  <FontAwesome name="star" size={32} color={theme.colors.primary} />
                </View>
              ))}
            </View>

            <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
              Congratulations!
            </Text>
            <Text variant="titleMedium" style={[styles.subtitle, { color: theme.colors.onSurface }]}>
              You've reached your daily step goal!
            </Text>
            <Text variant="titleLarge" style={[styles.points, { color: theme.colors.primary }]}>
              +{bonusPoints} Bonus Points Earned!
            </Text>
            <Text
              variant="bodyMedium"
              style={[styles.sharePrompt, { color: theme.colors.onSurfaceVariant }]}
            >
              Share your achievement to continue
            </Text>

            <View style={styles.shareButtonsContainer}>
              {shareButtons.map(({ platform, color, icon }) => (
                <Button
                  key={platform}
                  mode="contained"
                  onPress={() => handleShare(platform)}
                  style={[styles.shareButton, { backgroundColor: color }]}
                  icon={() => (
                    <FontAwesome name={icon} size={30} color="white" />
                  )}
                  contentStyle={styles.buttonContent}
                >
                  {''}
                </Button>
              ))}
            </View>
          </Surface>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default GoalCelebration;
