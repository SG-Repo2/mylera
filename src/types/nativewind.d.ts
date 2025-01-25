/// <reference types="nativewind/types" />
import type { ViewProps as RNViewProps } from 'react-native';
import type { TextProps as RNTextProps } from 'react-native';
import type { TextInputProps as RNTextInputProps } from 'react-native';
import type { PressableProps as RNPressableProps } from 'react-native';
import type { ImageProps as RNImageProps } from 'react-native';
import type { ScrollViewProps as RNScrollViewProps } from 'react-native';
import type { KeyboardAvoidingViewProps as RNKeyboardAvoidingViewProps } from 'react-native';
import type { SafeAreaViewProps as RNSafeAreaViewProps } from 'react-native';

declare module 'react-native' {
  export interface ViewProps extends RNViewProps {
    className?: string;
  }
  export interface TextProps extends RNTextProps {
    className?: string;
  }
  export interface TextInputProps extends RNTextInputProps {
    className?: string;
  }
  export interface PressableProps extends RNPressableProps {
    className?: string;
  }
  export interface ImageProps extends RNImageProps {
    className?: string;
  }
  export interface ScrollViewProps extends RNScrollViewProps {
    className?: string;
  }
  export interface KeyboardAvoidingViewProps extends RNKeyboardAvoidingViewProps {
    className?: string;
  }
  export interface SafeAreaViewProps extends RNSafeAreaViewProps {
    className?: string;
  }
}