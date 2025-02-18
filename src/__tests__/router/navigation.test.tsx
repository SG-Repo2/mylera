import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { mockRouter, routerHelpers } from '../setup/router';
import { RouterTestWrapper } from '../utils/RouterTestWrapper';
import HomeScreen from '@/app/(app)/(home)/index';

describe('Navigation Tests', () => {
  beforeEach(() => {
    routerHelpers.resetHistory();
  });

  it('handles navigation between screens', () => {
    // Simulate starting at home screen
    routerHelpers.navigateTo('/(app)/(home)');
    
    const { getByTestId } = render(
      <RouterTestWrapper>
        <HomeScreen />
      </RouterTestWrapper>
    );

    // Simulate navigation to leaderboard
    fireEvent.press(getByTestId('leaderboard-button'));
    
    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/leaderboard');
  });

  it('maintains navigation history', () => {
    routerHelpers.navigateTo('/(app)/(home)');
    routerHelpers.navigateTo('/(app)/leaderboard');
    routerHelpers.goBack();

    const history = routerHelpers.getNavigationHistory();
    expect(history.back).toHaveBeenCalledTimes(1);
  });

  it('handles deep linking paths', () => {
    // Simulate deep link navigation
    routerHelpers.navigateTo('/(app)/profile?id=123');
    
    expect(mockRouter.pathname).toBe('/(app)/profile');
    expect(mockRouter.segments).toEqual(['app', 'profile']);
  });
}); 