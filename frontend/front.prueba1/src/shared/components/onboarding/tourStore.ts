import { create } from 'zustand';

interface TourState {
  open: boolean;
  start: () => void;
  close: () => void;
}

/** Opens the first-run / replayable guide from anywhere (sidebar help button, auto-run). */
export const useTourStore = create<TourState>((set) => ({
  open: false,
  start: () => set({ open: true }),
  close: () => set({ open: false }),
}));

export const TOUR_SEEN_KEY = 'nw.tour.seen.v1';

export function tourSeen(): boolean {
  try {
    return window.localStorage.getItem(TOUR_SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

export function markTourSeen(): void {
  try {
    window.localStorage.setItem(TOUR_SEEN_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** Called on login so the guide auto-runs at the start of every session. */
export function resetTourSeen(): void {
  try {
    window.localStorage.removeItem(TOUR_SEEN_KEY);
  } catch {
    /* ignore */
  }
}
