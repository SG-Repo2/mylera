import { StyleSheet } from 'react-native';
import { theme } from '../theme/theme';

// Add spacing constants to match theme
const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const profileStyles = StyleSheet.create({
  settingBorder: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: spacing.xl,
  },
  headerTitle: {
    ...theme.fonts.headlineMedium,
    color: theme.colors.onBackground,
  },
  errorText: {
    ...theme.fonts.bodySmall,
    color: theme.colors.error,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    padding: spacing.lg,
    elevation: 1,
  },
  sectionTitle: {
    ...theme.fonts.titleLarge,
    color: theme.colors.onSurface,
    marginBottom: spacing.md,
  },
  form: {
    gap: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  profileCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    padding: spacing.lg,
    elevation: 1,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    padding: spacing.lg,
    elevation: 1,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: theme.colors.primary,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...theme.fonts.headlineMedium,
    color: theme.colors.onPrimary,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  editNameButton: {
    padding: 8,
    marginLeft: 8,
  },
  email: {
    ...theme.fonts.bodyLarge,
    color: theme.colors.onSurfaceVariant,
  },
  settingsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    elevation: 1,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  settingLabel: {
    ...theme.fonts.bodyLarge,
    color: theme.colors.onSurface,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    gap: spacing.sm,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.roundness,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutButton: {
    backgroundColor: theme.colors.error,
    borderRadius: theme.roundness,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonIcon: {
    marginRight: spacing.sm,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  displayNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  displayName: {
    ...theme.fonts.titleLarge,
    color: theme.colors.onSurface,
  },
  input: {
    ...theme.fonts.titleLarge,
    color: theme.colors.onSurface,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minWidth: 200,
  },
  // Avatar Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    padding: spacing.lg,
    width: '90%',
    maxWidth: 400,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...theme.fonts.titleLarge,
    color: theme.colors.onSurface,
  },
  avatarOption: {
    padding: spacing.sm,
    alignItems: 'center',
    flex: 1/3,
  },
  avatarOptionImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
});
