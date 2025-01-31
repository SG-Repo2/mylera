import React from 'react';
import { render } from '@testing-library/react-native';
import { LeaderboardEntry } from '../LeaderboardEntry';
import { mockLeaderboardEntries } from './mocks/leaderboardData';
import { theme } from '../../../theme/theme';

describe('LeaderboardEntry', () => {
  describe('Avatar Display', () => {
    it('renders avatar image when URL is provided', () => {
      const entryWithAvatar = mockLeaderboardEntries[0]; // First entry has avatar
      const { getByTestId } = render(
        <LeaderboardEntry entry={entryWithAvatar} />
      );

      const avatar = getByTestId('avatar-image');
      expect(avatar).toBeTruthy();
    });

    it('renders fallback avatar with initial when no URL is provided', () => {
      const entryWithoutAvatar = mockLeaderboardEntries[2]; // Third entry has no avatar
      const { getByText } = render(
        <LeaderboardEntry entry={entryWithoutAvatar} />
      );

      // Should show first letter of display name
      const initial = entryWithoutAvatar.display_name[0].toUpperCase();
      expect(getByText(initial)).toBeTruthy();
    });
  });

  describe('Highlighting', () => {
    it('applies highlight styles when highlight prop is true', () => {
      const entry = mockLeaderboardEntries[0];
      const { getByTestId } = render(
        <LeaderboardEntry entry={entry} highlight={true} />
      );

      const container = getByTestId('leaderboard-entry');
      expect(container.props.style).toContainEqual(
        expect.objectContaining({
          backgroundColor: theme.colors.primaryContainer,
        })
      );
      expect(container).toBeTruthy();
    });

    it('does not apply highlight styles when highlight prop is false', () => {
      const entry = mockLeaderboardEntries[0];
      const { getByTestId } = render(
        <LeaderboardEntry entry={entry} highlight={false} />
      );

      const container = getByTestId('leaderboard-entry');
      expect(container.props.style).toContainEqual(
        expect.objectContaining({
          backgroundColor: theme.colors.surface,
        })
      );
      expect(container).toBeTruthy();
    });
  });

  describe('Content Display', () => {
    it('displays rank, name and points correctly', () => {
      const entry = mockLeaderboardEntries[0];
      const { getByTestId } = render(
        <LeaderboardEntry entry={entry} />
      );

      expect(getByTestId('rank-text')).toHaveTextContent(String(entry.rank));
      expect(getByTestId('display-name')).toHaveTextContent(entry.display_name);
      expect(getByTestId('points-text')).toHaveTextContent(`${entry.total_points} pts`);
    });
  });

  describe('Accessibility', () => {
    it('includes proper accessibility labels', () => {
      const entry = mockLeaderboardEntries[0];
      const { getByTestId } = render(
        <LeaderboardEntry entry={entry} />
      );

      const accessibleElement = getByTestId('leaderboard-entry');
      expect(accessibleElement.props.accessibilityLabel).toBe(
        `${entry.display_name}, Rank ${entry.rank}, ${entry.total_points} points`
      );
      expect(accessibleElement).toBeTruthy();
    });

    it('includes position hint for highlighted entries', () => {
      const entry = mockLeaderboardEntries[0];
      const { getByTestId } = render(
        <LeaderboardEntry entry={entry} highlight={true} />
      );

      const accessibleElement = getByTestId('leaderboard-entry');
      expect(accessibleElement.props.accessibilityHint).toBe(
        "This is your position on the leaderboard"
      );
      expect(accessibleElement).toBeTruthy();
    });
  });

  // Snapshot Tests
  it('matches snapshot with avatar', () => {
    const entryWithAvatar = mockLeaderboardEntries[0];
    const { toJSON } = render(
      <LeaderboardEntry entry={entryWithAvatar} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('matches snapshot without avatar', () => {
    const entryWithoutAvatar = mockLeaderboardEntries[2];
    const { toJSON } = render(
      <LeaderboardEntry entry={entryWithoutAvatar} />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('matches snapshot when highlighted', () => {
    const entry = mockLeaderboardEntries[0];
    const { toJSON } = render(
      <LeaderboardEntry entry={entry} highlight={true} />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
