import { MD3LightTheme, configureFonts } from 'react-native-paper';
import { Platform } from 'react-native';

const colors = {
  primary: '#183E9F',
  secondary: '#F7A072',
  accent: '#A2D5F2',
  success: '#C3E8AC',
  background: '#F5E8C7',
  text: '#000000',
  surface: '#FFFFFF',
  error: '#FF5252',
};

const fontConfig = {
  customVariant: {
    fontFamily: Platform.select({
      web: 'Proxima Nova',
      ios: 'Proxima Nova',
      android: 'ProximaNova',
    }) ?? 'Proxima Nova',
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 20,
    fontSize: 14,
  },
};

export const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...colors,
  },
  roundness: 8,
};

export type AppTheme = typeof theme;