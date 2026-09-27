import { describe, expect, it } from 'vitest';
import { chordAtBar, midiName, parseChord, tonePitch } from './chords';
import { drumVoices, expandHits, expandNotes } from './patterns';
import type { Block, Element, Harmony } from '../types/track';

const harmony: Harmony = {
  progression: ['Am', 'F', 'C', 'G'],
  segments: [
    { mode: 'root', startBar: 1, endBar: 4 },
    { mode: 'progression', startBar: 5, endBar: 12 },
  ],
};
const blk = (over: Partial<Block>): Block => ({ startBar: 1, endBar: 4, confidence: 1, entry: { type: 'cut' }, exit: { type: 'cut' }, ...over });

describe('chords', () => {
  it('parses triads and accidentals', () => {
    expect(parseChord('Am')).toEqual({ pc: 9, minor: true });
    expect(parseChord('Db')).toEqual({ pc: 1, minor: false });
    expect(parseChord('Bb')).toEqual({ pc: 10, minor: false });
    expect(parseChord('Fm')).toEqual({ pc: 5, minor: true });
  });
  it('holds the root chord in root segments and cycles progressions', () => {
    expect(chordAtBar(harmony, 3)).toBe('Am');
    expect([5, 6, 7, 8, 9, 10, 11, 12].map((b) => chordAtBar(harmony, b))).toEqual(['Am', 'Am', 'F', 'F', 'C', 'C', 'G', 'G']);
  });
  it('builds chord tones from the root', () => {
    expect(midiName(tonePitch('r', parseChord('Am'), 2))).toBe('A2');
    expect(midiName(tonePitch('3', parseChord('Am'), 4))).toBe('C5');
    expect(midiName(tonePitch('3', parseChord('C'), 4))).toBe('E4');
    expect(midiName(tonePitch('8', parseChord('G'), 3))).toBe('G4');
  });
});

describe('expandHits', () => {
  const el: Element = {
    id: 'kick', name: 'Kick', family: 'kick',
    patterns: { four: { kind: 'hits', voices: { kick: [0, 4, 8, 12] } }, half: { kind: 'hits', voices: { kick: [0, 8] } } },
    blocks: [],
  };
  it('repeats the pattern every bar at the right sub-bar positions', () => {
    const hits = expandHits(el, blk({ pattern: 'four', startBar: 2, endBar: 3 }));
    expect(hits.map((h) => h.pos)).toEqual([1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75]);
  });
  it('swaps pattern inside an override range', () => {
    const hits = expandHits(el, blk({ pattern: 'four', startBar: 1, endBar: 4, overrides: [{ startBar: 3, endBar: 4, pattern: 'half' }] }));
    expect(hits).toHaveLength(2 * 4 + 2 * 2);
  });
  it('plays a multi-bar pattern one bar at a time', () => {
    const two: Element = { ...el, patterns: { p: { kind: 'hits', lengthBars: 2, voices: { kick: [0, 16] } } } };
    expect(expandHits(two, blk({ pattern: 'p', startBar: 1, endBar: 4 })).map((h) => h.pos)).toEqual([0, 1, 2, 3]);
  });
  it('lists voices in first-seen order', () => {
    const d: Element = { ...el, family: 'drums', patterns: { a: { kind: 'hits', voices: { clap: [4], hat: [2] } }, b: { kind: 'hits', voices: { hat: [2], perc: [7] } } } };
    expect(drumVoices(d)).toEqual(['clap', 'hat', 'perc']);
  });
});

describe('expandNotes', () => {
  const el: Element = {
    id: 'bass', name: 'Bass', family: 'bass',
    patterns: { root: { kind: 'notes', notes: [{ step: 0, len: 16, tone: 'r' }] }, stack: { kind: 'notes', notes: [{ step: 4, len: 2, tone: ['r', '3', '5'] }] } },
    blocks: [],
  };
  it('moves with the chord progression', () => {
    const notes = expandNotes(el, blk({ pattern: 'root', startBar: 5, endBar: 8 }), harmony, 2);
    expect(notes.map((n) => midiName(n.pitch))).toEqual(['A2', 'A2', 'F2', 'F2']);
  });
  it('stays on the root chord in a root segment', () => {
    const notes = expandNotes(el, blk({ pattern: 'root', startBar: 1, endBar: 4 }), harmony, 2);
    expect(new Set(notes.map((n) => n.pitch)).size).toBe(1);
  });
  it('stacks chord tones and sizes notes in bars', () => {
    const notes = expandNotes(el, blk({ pattern: 'stack', startBar: 1, endBar: 1 }), harmony, 4);
    expect(notes.map((n) => midiName(n.pitch))).toEqual(['A4', 'C5', 'E5']);
    expect(notes[0]).toMatchObject({ pos: 0.25, len: 0.125 });
  });
  it('clips a note at the end of its block', () => {
    const notes = expandNotes(el, blk({ pattern: 'root', startBar: 1, endBar: 1 }), harmony, 2);
    expect(notes[0].len).toBe(1);
  });
});
