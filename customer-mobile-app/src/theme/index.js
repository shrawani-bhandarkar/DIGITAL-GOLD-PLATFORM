import { StyleSheet } from 'react-native';

export const colors = {
  primary: '#064E3B',
  primaryDark: '#043D2E',
  secondary: '#0F766E',
  gold: '#D4AF6A',
  goldDark: '#806A2F',
  goldLight: '#F8F0DD',
  goldBorder: '#E8D8B4',
  background: '#F8F7F2',
  mutedSurface: '#EEF2EF',
  softTeal: '#EAF2F0',
  softChampagne: '#F5F1E8',
  silverSurface: '#EFF0F0',
  platinumSurface: '#E9ECEB',
  surface: '#FFFFFF',
  text: '#18221F',
  muted: '#68736D',
  border: '#E5E9E4',
  success: '#16834A',
  successBackground: '#EAF4EE',
  error: '#C0392B',
  errorBackground: '#FCECE9',
  lightMint: '#E8F1EC',
  onPrimary: '#E5EEE9',
  primaryDivider: '#477D68',
  warningBackground: '#F8F0DD',
  warningBorder: '#E8D8B4',
  warningText: '#66532B',
  disabledBackground: '#E6EAE6',
  disabledText: '#68736D',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  page: 20,
};

export const typography = {
  screenTitle: 26,
  sectionTitle: 17,
  body: 14,
  caption: 12,
  financialFigure: 30,
};

export const radii = {
  small: 10,
  medium: 14,
  large: 20,
  pill: 999,
};

export const commonStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.large,
    borderWidth: 1,
  },
  shadow: {
    elevation: 1,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
});
