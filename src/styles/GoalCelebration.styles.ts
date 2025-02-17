import { StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';

export const useStyles = () => {
  const theme = useTheme();

  return StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    buttonContent: {
      alignItems: 'center',
      flexDirection: 'row',
      height: '100%',
      justifyContent: 'center',
      margin: 0,
      padding: 0,
      width: '100%',
    },
    container: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
    },
    contentContainer: {
      maxWidth: 400,
      padding: 16,
      width: '90%',
    },
    points: {
      fontWeight: 'bold',
      marginBottom: 24,
      textAlign: 'center',
    },
    shareButton: {
      alignItems: 'center',
      borderRadius: 35,
      height: 70,
      justifyContent: 'center',
      margin: 4,
      overflow: 'hidden',
      padding: 0,
      width: 70,
    },
    shareButtonsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'center',
    },
    sharePrompt: {
      marginBottom: 16,
      textAlign: 'center',
    },
    starContainer: {
      padding: 4,
    },
    starsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 16,
    },
    subtitle: {
      marginBottom: 16,
      textAlign: 'center',
    },
    surface: {
      borderRadius: 24,
      elevation: 4,
      padding: 24,
    },
    title: {
      fontWeight: 'bold',
      marginBottom: 8,
      textAlign: 'center',
    },
  });
};
