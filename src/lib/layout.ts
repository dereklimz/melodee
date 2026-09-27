import type { ElementFamily, Track } from '../types/track';
import { chordAtBar, parseChord, tonePitch } from './chords';
import { drumVoices, expandNotes } from './patterns';

export const BASE_OCTAVE: Partial<Record<ElementFamily, number>> = { bass: 2, synth: 4, vocal: 4 };
export const CHORD_OCTAVE = 3;
export const STRIP_H = 14;

export type LaneKind = 'hits' | 'notes' | 'fx' | 'blocks';

export interface LaneMetrics {
  family: ElementFamily;
  kind: LaneKind;
  /** Height of the note / hit area. */
  notesH: number;
  /** Total lane height including padding and the automation strip. */
  h: number;
  strip: boolean;
  voices: string[];
  pitchMin: number;
  pitchMax: number;
}

const NOTES_H: Partial<Record<ElementFamily, number>> = { bass: 54, synth: 76, vocal: 46 };

export function laneMetrics(track: Track, family: ElementFamily): LaneMetrics {
  const el = track.elements.find((e) => e.family === family);
  const strip = !!el?.blocks.some((b) => (b.movements?.length ?? 0) > 0);
  const base = { family, strip, voices: [] as string[], pitchMin: 0, pitchMax: 0 };
  const total = (notesH: number) => 6 + notesH + (strip ? STRIP_H + 6 : 0) + 6;

  if (family === 'fx') return { ...base, kind: 'fx', notesH: 34, h: 46, strip: false };
  if (!el) return { ...base, kind: 'blocks', notesH: 20, h: total(20) };

  if (family === 'kick' || family === 'drums') {
    const voices = drumVoices(el);
    const notesH = Math.max(16, voices.length * 8 + 6);
    return { ...base, kind: voices.length ? 'hits' : 'blocks', voices, notesH, h: total(notesH) };
  }

  const octave = BASE_OCTAVE[family] ?? 4;
  const pitches = el.blocks.flatMap((b) => expandNotes(el, b, track.harmony, octave).map((n) => n.pitch));
  const notesH = NOTES_H[family] ?? 30;
  if (pitches.length === 0) return { ...base, kind: 'blocks', notesH: 20, h: total(20) };
  return { ...base, kind: 'notes', notesH, h: total(notesH), pitchMin: Math.min(...pitches), pitchMax: Math.max(...pitches) };
}

/** Pitch range of the chord stacks shown in the chords row. */
export function chordPitchRange(track: Track): { min: number; max: number } {
  const seen = new Set<string>();
  for (const seg of track.harmony.segments) {
    for (let b = seg.startBar; b <= seg.endBar; b++) seen.add(chordAtBar(track.harmony, b));
  }
  const pitches = [...seen].flatMap((sym) => (['r', '3', '5'] as const).map((t) => tonePitch(t, parseChord(sym), CHORD_OCTAVE)));
  return { min: Math.min(...pitches), max: Math.max(...pitches) };
}
