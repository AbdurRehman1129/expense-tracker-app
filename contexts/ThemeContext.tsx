import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { setSetting } from '@/db/settings';
import { AppColors, lightColors, darkColors } from '@/constants/colors';

export type ThemePreference = 'system' | 'light' | 'dark';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

type ThemeContextValue = {
  colors: AppColors;
  scheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const ThemeCtx = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({
  initialPreference,
  children,
}: {
  initialPreference: ThemePreference;
  children: ReactNode;
}) {
  const [preference, setPref] = useState<ThemePreference>(initialPreference);

  // Makes NATIVE widgets (TextInput, date/time pickers, Alert dialogs, Modal)
  // follow the in-app choice instead of only the phone's setting.
  useEffect(() => {
    Appearance.setColorScheme(preference === 'system' ? null : preference);
  }, [preference]);

  const systemScheme = useColorScheme();
  const scheme: 'light' | 'dark' =
    preference === 'system' ? (systemScheme ?? 'light') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: scheme === 'dark' ? darkColors : lightColors,
      scheme,
      preference,
      setPreference: (p) => {
        setPref(p);
        void setSetting('theme_preference', p);
      },
    }),
    [scheme, preference]
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme must be used inside AppThemeProvider');
  return ctx;
}

/** Builds a StyleSheet from a factory that receives the current colour tokens. */
export function useThemedStyles<T>(factory: (c: AppColors) => T): T {
  const { colors } = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => factory(colors), [colors]);
}
