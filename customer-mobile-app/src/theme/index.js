import { StyleSheet } from 'react-native';

export const colors = {
  primary: '#176B50',
  primaryDark: '#145A43',
  secondary: '#2D8062',
  gold: '#D6B45B',
  goldDark: '#806A2F',
  goldLight: '#F7F0DC',
  background: '#F7F5EF',
  surface: '#FFFFFF',
  text: '#263A2F',
  muted: '#747A73',
  border: '#E5E7DF',
  success: '#23834D',
  successBackground: '#E5F0E8',
  error: '#C74848',
  errorBackground: '#FDECEF',
  lightMint: '#E5F0E8',
  onPrimary: '#E5F0E8',
  primaryDivider: '#477D68',
  warningBackground: '#FBF4E4',
  warningBorder: '#E9DDBB',
  warningText: '#6A592F',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  page: 20,
};

export const commonStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
  },
  shadow: {
    elevation: 2,
    shadowColor: '#263A2F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
});
