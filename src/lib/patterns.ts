import { STEPS_PER_BAR, type Block, type Element, type Harmony, type HitPattern, type NotePattern } from '../types/track';
import { chordAtBar, parseChord, tonePitch } from './chords';

/** Positions are bars from the start of the song (bar 1 = 0), so x = x0 + pos * ppb. */
export interface HitEvent { voice: string; pos: number }
export interface NoteEvent { pos: number; len: number; pitch: number }

function patternAt(el: Element, block: Block, bar: number) {
  const o = block.overrides?.find((x) => bar >= x.startBar && bar <= x.endBar);
  const id = o?.pattern ?? block.pattern;
  return { pattern: id ? el.patterns?.[id] : undefined, runStart: o?.startBar ?? block.startBar };
}

/** Every drum hit a block plays, following overrides and multi-bar patterns. */
export function expandHits(el: Element, block: Block): HitEvent[] {
  const out: HitEvent[] = [];
  for (let bar = block.startBar; bar <= block.endBar; bar++) {
    const { pattern, runStart } = patternAt(el, block, bar);
    if (pattern?.kind !== 'hits') continue;
    const p = pattern as HitPattern;
    const phase = (bar - runStart) % (p.lengthBars ?? 1);
    for (const [voice, steps] of Object.entries(p.voices)) {
      for (const step of steps) if (Math.floor(step / STEPS_PER_BAR) === phase) out.push({ voice, pos: bar - 1 + (step % STEPS_PER_BAR) / STEPS_PER_BAR });
    }
  }
  return out;
}

/** Every note a block plays, with chord tones resolved against the harmony at each bar. */
export function expandNotes(el: Element, block: Block, harmony: Harmony, baseOctave: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  for (let bar = block.startBar; bar <= block.endBar; bar++) {
    const { pattern, runStart } = patternAt(el, block, bar);
    if (pattern?.kind !== 'notes') continue;
    const p = pattern as NotePattern;
    const phase = (bar - runStart) % (p.lengthBars ?? 1);
    const chord = parseChord(chordAtBar(harmony, bar));
    for (const n of p.notes) {
      if (Math.floor(n.step / STEPS_PER_BAR) !== phase) continue;
      const pos = bar - 1 + (n.step % STEPS_PER_BAR) / STEPS_PER_BAR;
      const len = Math.min(n.len / STEPS_PER_BAR, block.endBar - pos);
      for (const tone of Array.isArray(n.tone) ? n.tone : [n.tone]) out.push({ pos, len, pitch: tonePitch(tone, chord, baseOctave, n.oct ?? 0) });
    }
  }
  return out;
}

/** Voice rows for a drum element, in first-seen order across its patterns. */
export function drumVoices(el: Element): string[] {
  const seen: string[] = [];
  for (const p of Object.values(el.patterns ?? {})) if (p.kind === 'hits') for (const v of Object.keys(p.voices)) if (!seen.includes(v)) seen.push(v);
  return seen;
}
