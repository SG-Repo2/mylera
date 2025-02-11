import { StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';

export const useStyles = () => {
  const theme = useTheme();

  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    contentContainer: {
      width: '90%',
      maxWidth: 400,
      padding: 16,
    },
    surface: {
      borderRadius: 24,
      padding: 24,
      elevation: 4,
    },
    starsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: 16,
    },
    starContainer: {
      padding: 4,
    },
    title: {
      textAlign: 'center',
      fontWeight: 'bold',
      marginBottom: 8,
    },
    subtitle: {
      textAlign: 'center',
      marginBottom: 16,
    },
    points: {
      textAlign: 'center',
      fontWeight: 'bold',
      marginBottom: 24,
    },
    sharePrompt: {
      textAlign: 'center',
      marginBottom: 16,
    },
    shareButtonsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 12,
    },
    shareButton: {
      width: 70,
      height: 70,
      margin: 4,
      borderRadius: 35,
      padding: 0,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    buttonContent: {
      width: '100%',
      height: '100%',
      margin: 0,
      padding: 0,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
    },
  });
};
