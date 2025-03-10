import { StyleSheet, Platform } from 'react-native';
import { theme } from '../theme/theme';

export const leaderboardEntryStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: theme.roundness * 1.5,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  highlightBackground: {
    backgroundColor: '#BFDBFE',
  },
  rankContainer: {
    marginRight: 12,
    width: 32,
    alignItems: 'center',
  },
  rankText: {
    ...theme.fonts.titleLarge,
    color: '#1E293B',
    fontWeight: '700',
    fontSize: 24,
  },
  highlightText: {
    color: '#1E3A8A',
  },
  avatarContainer: {
    width: 56,
    marginVertical: 8,
  },
  podiumAvatarContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    ...theme.fonts.titleMedium,
    color: '#64748B',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 16,
  },
  displayName: {
    ...theme.fonts.titleMedium,
    color: '#1E293B',
    fontWeight: '600',
    fontSize: 18,
  },
  pointsText: {
    ...theme.fonts.bodyLarge,
    color: '#64748B',
    marginTop: 4,
    fontSize: 16,
  },
  // Podium-specific styles
  crown: {
    position: 'absolute',
    top: -16,
    alignSelf: 'center',
    zIndex: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  podiumContainer: {
    alignItems: 'center',
    padding: 12,
    borderRadius: theme.roundness * 1.5,
    backgroundColor: '#FFFFFF',
    height: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  podiumContent: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 8,
    width: '100%',
  },
  podiumDisplayName: {
    ...theme.fonts.titleMedium,
    color: '#1E293B',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
    paddingHorizontal: 4,
    marginTop: 25,
  },
  firstPlaceText: {
    ...theme.fonts.titleLarge,
    color: '#1E3A8A',
    fontWeight: '700',
    fontSize: 20,
  },
  podiumPoints: {
    ...theme.fonts.titleMedium,
    color: '#64748B',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 4,
  },
  firstPlacePoints: {
    ...theme.fonts.titleLarge,
    color: '#1E3A8A',
    fontWeight: '700',
    fontSize: 18,
  },
  firstPlaceAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  podiumAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
});
