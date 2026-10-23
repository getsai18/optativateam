import { create } from 'zustand';
import { applyTheme, readThemePreference, resolveTheme, saveThemePreference, type ThemePreference } from '../lib/theme';

interface ThemeState {
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: readThemePreference(),
  setPreference: (preference) => {
    saveThemePreference(preference);
    applyTheme(preference);
    set({ preference });
  },
}));

/** Current preference plus the resolved light/dark value. */
export function useTheme() {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  return { preference, resolved: resolveTheme(preference), setPreference };
}
