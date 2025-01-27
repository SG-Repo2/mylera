# UI/UX Guidelines and Component Patterns

## Design System

### Colors
```typescript
const colors = {
  primary: "#20B2AA", // Light Sea Green
  secondary: "#9B59B6", // Purple
  background: "#f9f9f9", // Light Gray
  text: {
    primary: "#2C3E50", // Dark Blue Gray
    secondary: "#7F8C8D", // Gray
    light: "#FFFFFF" // White
  },
  status: {
    success: "#2ECC71", // Green
    warning: "#F1C40F", // Yellow
    error: "#E74C3C" // Red
  }
};
```

### Typography
```typescript
const typography = {
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    "2xl": 24,
    "3xl": 30
  },
  weights: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700"
  }
};
```

### Spacing
```typescript
const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48
};
```

## Component Patterns

### Buttons

#### Primary Button
```typescript
interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}

// Usage with NativeWind
<Pressable 
  className={`
    bg-primary 
    px-4 
    py-3 
    rounded-lg
    ${disabled ? 'opacity-50' : 'opacity-100'}
  `}
  onPress={onPress}
  disabled={disabled}
>
  {loading ? (
    <ActivityIndicator color="white" />
  ) : (
    <Text className="text-white font-semibold text-center">
      {title}
    </Text>
  )}
</Pressable>
```

### Cards

#### MetricCard Pattern
```typescript
interface MetricCardProps {
  title: string;
  value: number;
  goal: number;
  points: number;
  unit: string;
  onPress?: () => void;
}

// Implementation guidelines
- Show progress bar
- Display current value and goal
- Include points earned
- Optional tap interaction
```

#### LeaderboardItem Pattern
```typescript
interface LeaderboardItemProps {
  rank: number;
  userName: string;
  points: number;
  isCurrentUser?: boolean;
}

// Implementation guidelines
- Highlight current user
- Show rank prominently
- Display points clearly
- Optional avatar
```

## Screen Patterns

### Layout Structure
```typescript
// Basic screen layout
<SafeAreaView className="flex-1 bg-background">
  <View className="px-4 py-3">
    <Header />
    <Content />
    <Footer />
  </View>
</SafeAreaView>
```

### Common Screen Elements

#### Headers
```typescript
// Standard header
<View className="flex-row justify-between items-center py-4">
  <Text className="text-xl font-bold">{title}</Text>
  {rightElement && <View>{rightElement}</View>}
</View>
```

#### Loading States
```typescript
// Full screen loading
<View className="flex-1 justify-center items-center">
  <ActivityIndicator size="large" color={colors.primary} />
  <Text className="mt-2 text-gray-600">Loading...</Text>
</View>

// Content placeholder
<View className="animate-pulse">
  <View className="h-20 bg-gray-200 rounded-lg mb-4" />
</View>
```

#### Error States
```typescript
// Error display
<View className="flex-1 justify-center items-center p-4">
  <Text className="text-error text-lg mb-2">Something went wrong</Text>
  <Text className="text-gray-600 text-center mb-4">
    {errorMessage}
  </Text>
  <Button title="Try Again" onPress={retry} />
</View>
```

## Animation Guidelines

### Micro-interactions
- Use subtle scale transforms for button presses
- Implement smooth transitions between states
- Keep animations under 300ms for responsiveness

```typescript
// Button press animation
const animatedScale = useAnimatedStyle(() => ({
  transform: [{ scale: withSpring(pressed.value ? 0.95 : 1) }]
}));
```

### Screen Transitions
- Use default platform transitions when possible
- Implement custom transitions sparingly
- Ensure smooth gesture-based navigation

## Form Patterns

### Input Fields
```typescript
interface InputFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  placeholder?: string;
  secureTextEntry?: boolean;
}

// Implementation
<View className="mb-4">
  <Text className="text-sm text-gray-600 mb-1">{label}</Text>
  <TextInput
    className={`
      bg-white 
      p-3 
      rounded-lg 
      border 
      ${error ? 'border-error' : 'border-gray-200'}
    `}
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    secureTextEntry={secureTextEntry}
  />
  {error && (
    <Text className="text-error text-sm mt-1">{error}</Text>
  )}
</View>
```

## Accessibility Guidelines

### Touch Targets
- Minimum touch target size: 44x44 points
- Adequate spacing between interactive elements
- Clear visual feedback on interaction

### Color Contrast
- Maintain WCAG 2.1 AA standard (4.5:1 for normal text)
- Use color + icons for status indicators
- Provide sufficient contrast for text on backgrounds

### Screen Readers
- Implement proper accessibilityLabel props
- Use semantic HTML elements
- Provide clear navigation hierarchy

## Responsive Design

### Device Adaptation
```typescript
// Responsive spacing
const containerPadding = useWindowDimensions().width < 375 ? 16 : 24;

// Dynamic font sizing
const fontSize = Math.min(width * 0.04, 20);
```

### Orientation Changes
- Support both portrait and landscape
- Adjust layouts dynamically
- Maintain content readability

## Performance Considerations

### Image Handling
- Use appropriate image sizes
- Implement lazy loading
- Cache frequently used images

### List Optimization
- Implement virtualization for long lists
- Use memo for list items
- Optimize re-renders

## Testing & Quality Assurance

### Visual Testing
- Test on multiple device sizes
- Verify dark/light mode compatibility
- Check animation performance

### Interaction Testing
- Verify touch feedback
- Test gesture interactions
- Validate form behavior

### Accessibility Testing
- Screen reader compatibility
- Color contrast verification
- Touch target size validation

## Implementation Checklist

### New Components
- [ ] Follows design system
- [ ] Implements proper types
- [ ] Handles loading states
- [ ] Manages error states
- [ ] Supports accessibility
- [ ] Optimized for performance

### Screen Implementation
- [ ] Uses consistent layout patterns
- [ ] Implements proper navigation
- [ ] Handles device rotation
- [ ] Manages keyboard interaction
- [ ] Supports pull-to-refresh (if applicable)
- [ ] Implements proper error boundaries

## Best Practices

1. **Component Organization**
   - Keep components focused and single-responsibility
   - Use composition over inheritance
   - Implement proper prop validation

2. **Style Management**
   - Use NativeWind classes consistently
   - Avoid inline styles
   - Maintain design system tokens

3. **Performance**
   - Optimize re-renders
   - Implement proper memoization
   - Use appropriate image formats

4. **Accessibility**
   - Implement proper ARIA labels
   - Maintain focus management
   - Support screen readers

5. **Testing**
   - Write component tests
   - Implement visual regression testing
   - Validate accessibility compliance