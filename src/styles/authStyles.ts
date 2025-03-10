import { StyleSheet, Platform } from 'react-native';
import { brandColors } from '@/src/theme/theme';

export const authStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.neutral,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 24,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  banner: {
    width: '80%',
    height: 40,
    marginBottom: 8,
  },
  headerTitle: {
    color: brandColors.primary,
    fontSize: 24,
    marginBottom: 4,
  },
  formContainer: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  input: {
    marginBottom: 4,
    backgroundColor: '#FFFFFF',
    height: 48,
  },
  errorText: {
    marginBottom: 8,
    fontSize: 12,
  },
  // Avatar selection styles
  avatarContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  avatarOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginVertical: 4,
  },
  avatarOptionSelected: {
    borderColor: brandColors.primary,
    borderWidth: 3,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  // Section styling
  sectionTitle: {
    marginTop: 12,
    marginBottom: 8,
    color: brandColors.primary,
    fontSize: 18,
  },
  // Device option styles
  deviceContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  deviceOptionWrapper: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceOptionSelected: {
    backgroundColor: `${brandColors.primary}10`,
    borderColor: brandColors.primary,
  },
  deviceIcon: {
    opacity: 0.8,
  },
  deviceOptionText: {
    flex: 1,
    fontSize: 14,
    color: '#64748B',
  },
  deviceOptionTextSelected: {
    color: brandColors.primary,
    fontWeight: '600',
  },
  // Measurement system styles
  measurementContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  measurementButton: {
    flex: 1,
    borderRadius: 100,
    borderColor: '#E2E8F0',
  },
  measurementButtonSelected: {
    backgroundColor: brandColors.primary,
  },
  measurementButtonContent: {
    height: 40,
  },
  measurementButtonLabel: {
    fontSize: 14,
    letterSpacing: 0,
    color: '#64748B',
  },
  measurementButtonLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Error display
  errorContainer: {
    marginVertical: 8,
    alignItems: 'center',
  },
  submitError: {
    textAlign: 'center',
    marginBottom: 8,
    fontSize: 14,
    color: '#EF4444', // Error color
  },
  // Button styles
  button: {
    marginTop: 4,
    marginBottom: 16,
    borderRadius: 100,
    backgroundColor: brandColors.primary,
  },
  buttonContent: {
    height: 44,
  },
  buttonLabel: {
    fontSize: 16,
    letterSpacing: 0,
    fontWeight: '600',
  },
  quickSignInButton: {
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 100,
    backgroundColor: brandColors.secondary,
    width: '80%',
  },
  quickSignInButtonContent: {
    height: 40,
  },
  quickSignInButtonLabel: {
    fontSize: 14,
    letterSpacing: 0,
    fontWeight: '600',
  },
  // Sign in section
  signInContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  signInText: {
    color: '#64748B',
    fontSize: 14,
  },
  signInButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: brandColors.secondary,
  },
});
