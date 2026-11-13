import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Brand, DarkBrand, LightColors, DarkColors, ThemeColors, BrandPalette } from '@/src/constants/Colors';

const THEME_KEY = '@sakayne_theme';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  colors: ThemeColors;
  brand: BrandPalette;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light', isDark: false, colors: LightColors, brand: Brand, toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((v) => { if (v === 'dark' || v === 'light') setTheme(v); });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    // Keep browser rendering and the app toggle in sync, including Auto Dark.
    document.documentElement.dataset.appTheme = theme;
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'only light';
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    AsyncStorage.setItem(THEME_KEY, next);
  };

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', colors: theme === 'dark' ? DarkColors : LightColors, brand: theme === 'dark' ? DarkBrand : Brand, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
