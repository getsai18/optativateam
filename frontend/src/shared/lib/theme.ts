import { localStore } from './storage';

export type ThemePreference = 'light' | 'dark' | 'system';

const KEY = 'billing.theme';

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function readThemePreference(): ThemePreference {
  const stored = localStore.get<ThemePreference>(KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return pref;
}

/** Applies the theme by toggling `.dark` on <html> (Tailwind `darkMode: 'class'`). */
export function applyTheme(pref: ThemePreference): void {
  document.documentElement.classList.toggle('dark', resolveTheme(pref) === 'dark');
}

export function saveThemePreference(pref: ThemePreference): void {
  localStore.set(KEY, pref);
}

/** Call once before the first render so the page never flashes the wrong theme. */
export function initTheme(): void {
  applyTheme(readThemePreference());
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (readThemePreference() === 'system') applyTheme('system');
  });
}
