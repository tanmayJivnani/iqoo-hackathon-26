import { MD3LightTheme } from 'react-native-paper';

// Current palette stays unchanged. Category-specific colours will be introduced separately.
export const colors = {
  primary: '#246B45', text: '#19392A', background: '#FFFFFF', canvas: '#F6F8F4',
  surface: '#FFFFFF', muted: '#738078', border: '#E9EEE9',
  primaryContainer: '#E8F0EA', input: '#FBFCFA', inputBorder: '#DDE4DD',
  evidenceBackground: '#E5EAE5', evidenceCaption: '#516157', danger: '#B84D40',
  neutralContainer: '#E8EBEF', neutralText: '#495463',
};
export const spacing = { small: 8, medium: 16, large: 24 };
export const radii = { control: 15, card: 18 };
export const appTheme = {
  ...MD3LightTheme,
  roundness: 4,
  colors: { ...MD3LightTheme.colors, primary: colors.primary, onPrimary: '#FFFFFF',
    primaryContainer: colors.primaryContainer, onPrimaryContainer: colors.primary,
    background: colors.background, surface: colors.surface, onSurface: colors.text,
    outline: colors.inputBorder, error: colors.danger },
};
