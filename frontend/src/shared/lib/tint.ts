import type { CSSProperties } from 'react';

/** Hue pair: readable on a light surface / readable on a dark surface. */
export interface Tint {
  light: string;
  dark: string;
}

export const TINTS: Tint[] = [
  { light: '#0B6B5E', dark: '#4FD1BA' },
  { light: '#1F5FA8', dark: '#7EB4F0' },
  { light: '#9A6208', dark: '#F2B95A' },
  { light: '#6B3FA0', dark: '#C29AF0' },
  { light: '#B3392F', dark: '#F28C80' },
  { light: '#4C7A2A', dark: '#A3D27A' },
  { light: '#1B6E8A', dark: '#77C6E0' },
  { light: '#4B45A1', dark: '#A8A3F0' },
];

/**
 * Soft tinted background + strong text in the same hue, for both themes.
 * Pair with TINT_CLASS; the colours come in through CSS variables.
 */
export const TINT_CLASS =
  'bg-[color-mix(in_srgb,var(--tint)_13%,transparent)] text-[var(--tint)] ' +
  'dark:bg-[color-mix(in_srgb,var(--tint-dark)_16%,transparent)] dark:text-[var(--tint-dark)]';

export function tintStyle(t: Tint): CSSProperties {
  return { '--tint': t.light, '--tint-dark': t.dark } as CSSProperties;
}
