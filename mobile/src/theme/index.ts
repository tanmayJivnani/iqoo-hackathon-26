import { MD3LightTheme } from 'react-native-paper';

export const categoryPalettes = {
  TREES: { primary: '#527E3D', primaryContainer: '#E6F4DB', hero: '#D9EDC9', text: '#25412A', button: '#B3DA94', buttonText: '#244024', frost: 'rgba(153,194,119,0.22)', canvas: '#F7FAF4' },
  ROADS: { primary: '#5F6972', primaryContainer: '#E8EBEE', hero: '#DDE2E6', text: '#303B44', button: '#BFC8CF', buttonText: '#27343E', frost: 'rgba(155,166,176,0.22)', canvas: '#F5F6F7' },
  GARBAGE: { primary: '#876500', primaryContainer: '#FFF4C7', hero: '#FFF0B2', text: '#5D490D', button: '#F5CF55', buttonText: '#534007', frost: 'rgba(244,203,72,0.22)', canvas: '#FFFCF3' },
  NOISE: { primary: '#B84825', primaryContainer: '#FCE4D9', hero: '#F9D8CA', text: '#642B1B', button: '#F39B72', buttonText: '#642B1B', frost: 'rgba(231,113,69,0.22)', canvas: '#FFF7F3' },
};
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
