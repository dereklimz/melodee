import type { Edge, EnergySegment, HarmonySegment, Movement, MovementType } from '../types/track';

export type Point = [number, number];

/** Shared horizontal scale: bar 1 starts at x0, every bar is `ppb` pixels wide. */
export interface Scale {
  x0: number;
  ppb: number;
}

export const barLeft = (s: Scale, bar: number) => s.x0 + (bar - 1) * s.ppb;
/** Right edge of a bar; endBar is inclusive so a block ends at barRight(endBar). */
export const barRight = (s: Scale, bar: number) => s.x0 + bar * s.ppb;

/**
 * Outline of a block. Highpass sweeps start as a sliver at the top (only highs
 * present) and grow downward; lowpass sweeps do the reverse. On exit the
 * high-pass rolls the low end away first, the low-pass rolls the highs away.
 */
export function blockPolygon(x0: number, x1: number, top: number, bot: number, entry: Edge, exit: Edge, ppb: number): Point[] {
  const maxW = (x1 - x0) / 2;
  const wedge = (e: Edge) => Math.min(Math.max((e.bars ?? 0) * ppb, 0), maxW);

  let leftTop: Point = [x0, top];
  let leftBot: Point = [x0, bot];
  if (entry.type === 'highpass_sweep') leftBot = [x0 + wedge(entry), bot];
  if (entry.type === 'lowpass_sweep') leftTop = [x0 + wedge(entry), top];

  let rightTop: Point = [x1, top];
  let rightBot: Point = [x1, bot];
  if (exit.type === 'highpass_sweep') rightBot = [x1 - wedge(exit), bot];
  if (exit.type === 'lowpass_sweep') rightTop = [x1 - wedge(exit), top];

  return [leftTop, rightTop, rightBot, leftBot];
}

/** Fraction (0-1) of the block width taken by a fade at each edge. */
export function fadeStops(x0: number, x1: number, entry: Edge, exit: Edge, ppb: number) {
  const w = x1 - x0;
  const frac = (e: Edge) => (e.type === 'fade' || e.type === 'reverb_wash' ? Math.min((e.bars ?? 0) * ppb, w / 2) / w : 0);
  return { entry: frac(entry), exit: frac(exit) };
}

/**
 * Stepped energy line. Flat segments hold their level, ramps travel from the
 * previous level to this one, and a dip drops to `level` mid-segment and comes
 * back up to meet the next segment. Adjacent segments share an x, so a change
 * of level between them is a vertical step.
 */
export function energyPoints(segments: EnergySegment[], s: Scale, yTop: number, yBottom: number): Point[] {
  const yOf = (level: number) => yBottom - level * (yBottom - yTop);
  const sorted = [...segments].sort((a, b) => a.startBar - b.startBar);
  const pts: Point[] = [];
  let prevEnd: number | undefined;

  sorted.forEach((seg, i) => {
    const xs = barLeft(s, seg.startBar);
    const xe = barRight(s, seg.endBar);
    const next = sorted[i + 1];
    let start = seg.level;
    let end = seg.level;
    if (seg.shape === 'ramp_up' || seg.shape === 'ramp_down') start = prevEnd ?? seg.level;
    if (seg.shape === 'dip') {
      start = prevEnd ?? seg.level;
      end = next ? next.level : start;
    }
    pts.push([xs, yOf(start)]);
    if (seg.shape === 'dip') pts.push([(xs + xe) / 2, yOf(seg.level)]);
    pts.push([xe, yOf(end)]);
    prevEnd = end;
  });
  return pts;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** How "present" a movement is at t in [0,1]: 0 = bottom of the block, 1 = top. */
export function movementValue(type: MovementType, t: number): number {
  switch (type) {
    case 'fade_up':
      return 0.1 + 0.8 * t;
    case 'fade_down':
      return 0.9 - 0.8 * t;
    case 'lowpass_open':
    case 'highpass_open':
      return 0.15 + 0.75 * smooth(t);
    case 'lowpass_close':
    case 'highpass_close':
      return 0.9 - 0.75 * smooth(t);
    case 'reverb_up':
      return 0.1 + 0.8 * Math.pow(t, 1.4);
    case 'reverb_down':
      return 0.9 - 0.8 * Math.pow(t, 0.7);
    case 'delay_throw':
      return t < 0.2 ? 0.15 + 0.75 * (t / 0.2) : 0.15 + 0.75 * Math.exp((-4 * (t - 0.2)) / 0.8);
  }
}

export function movementPoints(m: Movement, s: Scale, top: number, bottom: number): Point[] {
  const x0 = barLeft(s, m.startBar);
  const x1 = barRight(s, m.endBar);
  const n = Math.max(6, Math.ceil((x1 - x0) / 3));
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([x0 + (x1 - x0) * t, bottom - movementValue(m.type, t) * (bottom - top)]);
  }
  return pts;
}

export interface ChordCell {
  symbol: string;
  startBar: number;
  endBar: number;
}

/** Splits a progression segment into one cell per chord, cycling the progression. */
export function chordCells(seg: HarmonySegment, progression: string[], barsPerChord = 2): ChordCell[] {
  if (seg.mode === 'root') return [{ symbol: progression[0], startBar: seg.startBar, endBar: seg.endBar }];
  const cells: ChordCell[] = [];
  for (let bar = seg.startBar, i = 0; bar <= seg.endBar; bar += barsPerChord, i++) {
    cells.push({ symbol: progression[i % progression.length], startBar: bar, endBar: Math.min(bar + barsPerChord - 1, seg.endBar) });
  }
  return cells;
}

export const toPoints = (pts: Point[]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
export const toPath = (pts: Point[]) => pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
