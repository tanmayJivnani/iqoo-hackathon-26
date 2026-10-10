import { createContext, useContext, type ReactNode } from 'react';
import { PaperProvider } from 'react-native-paper';
import { appTheme, categoryPalettes } from './index';
import type { CivicDomain } from '../data/civic';

const CategoryContext = createContext(categoryPalettes.TREES);
export const useCategoryPalette = () => useContext(CategoryContext);
export function CategoryTheme({ domain, children }: { domain: CivicDomain; children: ReactNode }) {
  const palette = categoryPalettes[domain];
  const theme = { ...appTheme, colors: { ...appTheme.colors, primary: palette.primary,
    primaryContainer: palette.primaryContainer, onPrimaryContainer: palette.primary,
    onSurface: palette.text, background: palette.canvas } };
  return <CategoryContext.Provider value={palette}><PaperProvider theme={theme}>{children}</PaperProvider></CategoryContext.Provider>;
}
