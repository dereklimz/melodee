import type { TrackInfo } from '../types/track';

export const secondsPerBar = (t: Pick<TrackInfo, 'bpm'>) => (4 * 60) / t.bpm;

/** Time at the start of a (1-indexed) bar. */
export const barToSeconds = (t: Pick<TrackInfo, 'bpm' | 'firstDownbeatSec'>, bar: number) =>
  t.firstDownbeatSec + (bar - 1) * secondsPerBar(t);

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const trackLength = (t: Pick<TrackInfo, 'bpm' | 'totalBars'>) => formatTime(t.totalBars * secondsPerBar(t));
