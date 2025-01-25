import 'expo-router/entry';
import 'react-native-url-polyfill/auto';
import { withExpoSnack } from 'nativewind';

// Register for NativeWind
withExpoSnack(require('./app/_layout').default);