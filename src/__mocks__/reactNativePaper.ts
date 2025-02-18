// Theme colors
const colors = {
  primary: '#6200EE',
  primaryContainer: '#E8DEF8',
  surface: '#FFFFFF',
  surfaceVariant: '#E7E0EC',
  onSurface: '#1C1B1F',
  onSurfaceVariant: '#49454F',
  background: '#F6F6F6',
  error: '#B00020',
  success: '#00C853',
  warning: '#FB8C00',
  info: '#2196F3',
};

// Theme configuration
export const MD3LightTheme = {
  colors,
  roundness: 4,
  fonts: {
    headlineMedium: { fontSize: 28, fontWeight: '400' },
    headlineSmall: { fontSize: 24, fontWeight: '400' },
    titleLarge: { fontSize: 22, fontWeight: '400' },
    titleMedium: { fontSize: 16, fontWeight: '500' },
    titleSmall: { fontSize: 14, fontWeight: '500' },
    bodyLarge: { fontSize: 16, fontWeight: '400' },
    bodyMedium: { fontSize: 14, fontWeight: '400' },
    bodySmall: { fontSize: 12, fontWeight: '400' },
  },
  animation: {
    scale: 1.0,
  },
};

// Mock components
const createMockPaperComponent = (name: string) => {
  const Component = ({ children, ...props }: any) => ({
    $$typeof: Symbol.for('react.element'),
    type: name,
    props: { ...props, children },
    ref: null,
  });
  Component.displayName = name;
  return Component;
};

// Mock hook
export const useTheme = jest.fn(() => MD3LightTheme);

// Export mock components
export default {
  MD3LightTheme,
  useTheme,
  Card: createMockPaperComponent('Card'),
  Text: createMockPaperComponent('PaperText'),
  Button: createMockPaperComponent('Button'),
  ActivityIndicator: createMockPaperComponent('ActivityIndicator'),
  Surface: createMockPaperComponent('Surface'),
  IconButton: createMockPaperComponent('IconButton'),
  Divider: createMockPaperComponent('Divider'),
  Portal: createMockPaperComponent('Portal'),
  Modal: createMockPaperComponent('Modal'),
  Menu: createMockPaperComponent('Menu'),
  Appbar: {
    Header: createMockPaperComponent('Appbar.Header'),
    Content: createMockPaperComponent('Appbar.Content'),
    Action: createMockPaperComponent('Appbar.Action'),
    BackAction: createMockPaperComponent('Appbar.BackAction'),
  },
  List: {
    Item: createMockPaperComponent('List.Item'),
    Section: createMockPaperComponent('List.Section'),
    Accordion: createMockPaperComponent('List.Accordion'),
  },
  TextInput: createMockPaperComponent('TextInput'),
  HelperText: createMockPaperComponent('HelperText'),
  Snackbar: createMockPaperComponent('Snackbar'),
  FAB: createMockPaperComponent('FAB'),
  Badge: createMockPaperComponent('Badge'),
  Chip: createMockPaperComponent('Chip'),
  Switch: createMockPaperComponent('Switch'),
  Checkbox: createMockPaperComponent('Checkbox'),
  RadioButton: createMockPaperComponent('RadioButton'),
  ProgressBar: createMockPaperComponent('ProgressBar'),
  Banner: createMockPaperComponent('Banner'),
  Dialog: {
    Title: createMockPaperComponent('Dialog.Title'),
    Content: createMockPaperComponent('Dialog.Content'),
    Actions: createMockPaperComponent('Dialog.Actions'),
    ScrollArea: createMockPaperComponent('Dialog.ScrollArea'),
  },
};

// Helper functions for testing
export const simulateThemeChange = (newTheme: typeof MD3LightTheme) => {
  useTheme.mockReturnValue(newTheme);
};

export const resetPaperMocks = () => {
  useTheme.mockReturnValue(MD3LightTheme);
};
