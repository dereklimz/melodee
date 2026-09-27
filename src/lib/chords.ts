import type { ChordTone, Harmony } from '../types/track';

const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export interface ParsedChord { pc: number; minor: boolean }

/** Understands the plain triads the mock data uses: C, Am, Db, Bb, Fm… */
export function parseChord(symbol: string): ParsedChord {
  const m = /^([A-G])([#b]?)(m?)/.exec(symbol);
  if (!m) throw new Error(`Unrecognised chord "${symbol}"`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return { pc: (LETTER[m[1]] + acc + 12) % 12, minor: m[3] === 'm' };
}

/** Chord sounding at a (1-indexed) bar: root segments hold the first chord, progressions cycle. */
export function chordAtBar(h: Harmony, bar: number): string {
  const seg = h.segments.find((s) => bar >= s.startBar && bar <= s.endBar);
  if (!seg || seg.mode === 'root') return h.progression[0];
  const per = h.barsPerChord ?? 2;
  return h.progression[Math.floor((bar - seg.startBar) / per) % h.progression.length];
}

/** MIDI pitch of a chord tone, with the chord root placed in `baseOctave` (C4 = 60). */
export function tonePitch(tone: ChordTone, chord: ParsedChord, baseOctave: number, octShift = 0): number {
  const interval = { r: 0, '3': chord.minor ? 3 : 4, '5': 7, '7': 10, '8': 12 }[tone];
  return 12 * (baseOctave + 1) + chord.pc + interval + 12 * octShift;
}

export const midiName = (pitch: number) => `${NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
