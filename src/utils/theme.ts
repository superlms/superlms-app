import React, { createContext, useContext, useMemo } from 'react';

// The app ships a single, light visual theme. (Dark mode was removed.)
export type ThemeMode = 'light';

// ── Palette ───────────────────────────────────────────────────────────────────
const lightColors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  card: '#FFFFFF',

  primary: '#4F46E5',
  primaryLight: '#E0E7FF',
  secondary: '#0EA5E9',

  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  white: '#FFFFFF',

  border: '#E2E8F0',
  statusBar: '#E2E8F0',
  shadow: '#0F172A',
  iconActive: '#4F46E5',
  iconInactive: '#94A3B8',

  danger: '#EF4444',
  success: '#22C55E',
};

// ── Theme singleton ───────────────────────────────────────────────────────────
// Screens read `theme.colors.*` directly (inline and inside StyleSheet
// factories). The values are constant for the lifetime of the app.
export const theme = {
  colors: { ...lightColors },
  spacing: { xs: 6, sm: 10, md: 14, lg: 20, xl: 28 },
  radius: { sm: 10, md: 14, lg: 18, full: 999 },
  mode: 'light' as ThemeMode,
};

// ── Theme-change subscription ─────────────────────────────────────────────────
// Kept as a no-op so the per-screen StyleSheet factories that register here keep
// compiling. There is only one theme now, so the callback never needs to fire.
type Listener = () => void;

export const onThemeChange = (_cb: Listener): (() => void) => {
  return () => {};
};

// ── React context / provider ──────────────────────────────────────────────────
interface ThemeCtxValue {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
}

const ThemeCtx = createContext<ThemeCtxValue>({
  mode: 'light',
  isDark: false,
  setMode: () => {},
  toggle: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const value = useMemo<ThemeCtxValue>(
    () => ({ mode: 'light', isDark: false, setMode: () => {}, toggle: () => {} }),
    [],
  );

  return React.createElement(ThemeCtx.Provider, { value }, children);
};

export const useThemeMode = (): ThemeCtxValue => useContext(ThemeCtx);
