import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { Surface } from 'react-native-paper';

export const StableLayout = memo(function StableLayout({ 
  children 
}: {
  children: React.ReactNode
}) {
  return (
    <Surface style={styles.container}>
      {children}
    </Surface>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB'
  }
});