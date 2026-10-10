/** Deterministic PRNG (mulberry32) so every seed run produces the same dataset. */
export interface Rng {
  next: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  chance: (p: number) => boolean;
  shuffle: <T>(items: readonly T[]) => T[];
  uuid: () => string;
  code: (alphabet: string, length: number) => string;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number): number => Math.floor(next() * (max - min + 1)) + min;
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T;
  const chance = (p: number): boolean => next() < p;
  const shuffle = <T,>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
    }
    return copy;
  };
  const code = (alphabet: string, length: number): string => {
    let out = '';
    for (let i = 0; i < length; i++) out += alphabet.charAt(Math.floor(next() * alphabet.length));
    return out;
  };
  const uuid = (): string => {
    const hex = (n: number) => code('0123456789abcdef', n);
    return `${hex(8)}-${hex(4)}-4${hex(3)}-${pick(['8', '9', 'a', 'b'])}${hex(3)}-${hex(12)}`;
  };
  return { next, int, pick, chance, shuffle, uuid, code };
}
