import { describe, expect, it } from 'vitest';
import { barLeft, barRight, blockPolygon, chordCells, energyPoints, fadeStops, movementPoints, movementValue } from './geometry';

const s = { x0: 100, ppb: 10 };

describe('bar scale', () => {
  it('maps 1-indexed inclusive bars to pixels', () => {
    expect(barLeft(s, 1)).toBe(100);
    expect(barRight(s, 1)).toBe(110);
    expect(barRight(s, 16)).toBe(barLeft(s, 17));
  });
});

describe('blockPolygon', () => {
  const cut = { type: 'cut' } as const;
  it('is a rectangle for cut edges', () => {
    expect(blockPolygon(0, 100, 0, 30, cut, cut, 10)).toEqual([[0, 0], [100, 0], [100, 30], [0, 30]]);
  });
  it('starts a highpass entry as a sliver at the top', () => {
    const p = blockPolygon(0, 100, 0, 30, { type: 'highpass_sweep', bars: 4 }, cut, 10);
    expect(p[0]).toEqual([0, 0]);
    expect(p[3]).toEqual([40, 30]);
  });
  it('starts a lowpass entry as a sliver at the bottom', () => {
    const p = blockPolygon(0, 100, 0, 30, { type: 'lowpass_sweep', bars: 4 }, cut, 10);
    expect(p[0]).toEqual([40, 0]);
    expect(p[3]).toEqual([0, 30]);
  });
  it('rolls the low end away first on a highpass exit', () => {
    const p = blockPolygon(0, 100, 0, 30, cut, { type: 'highpass_sweep', bars: 2 }, 10);
    expect(p[1]).toEqual([100, 0]);
    expect(p[2]).toEqual([80, 30]);
  });
  it('never lets a wedge exceed half the block', () => {
    const p = blockPolygon(0, 40, 0, 30, { type: 'highpass_sweep', bars: 20 }, cut, 10);
    expect(p[3][0]).toBe(20);
  });
});

describe('fadeStops', () => {
  it('reports fade fractions and ignores cuts and sweeps', () => {
    const f = fadeStops(0, 100, { type: 'fade', bars: 2 }, { type: 'highpass_sweep', bars: 2 }, 10);
    expect(f).toEqual({ entry: 0.2, exit: 0 });
  });
});

describe('energyPoints', () => {
  const yTop = 0;
  const yBottom = 100;
  it('holds flat segments and steps between them', () => {
    const pts = energyPoints(
      [
        { startBar: 1, endBar: 4, level: 0.2, shape: 'flat' },
        { startBar: 5, endBar: 8, level: 0.8, shape: 'flat' },
      ],
      s, yTop, yBottom,
    );
    expect(pts).toEqual([[100, 80], [140, 80], [140, 20], [180, 20]]);
  });
  it('ramps from the previous level', () => {
    const pts = energyPoints(
      [
        { startBar: 1, endBar: 4, level: 0.2, shape: 'flat' },
        { startBar: 5, endBar: 8, level: 0.6, shape: 'ramp_up' },
      ],
      s, yTop, yBottom,
    );
    expect(pts[2]).toEqual([140, 80]);
    expect(pts[3]).toEqual([180, 40]);
  });
  it('dips mid-segment and rejoins the next level with no step', () => {
    const pts = energyPoints(
      [
        { startBar: 1, endBar: 2, level: 0.6, shape: 'flat' },
        { startBar: 3, endBar: 4, level: 0.1, shape: 'dip' },
        { startBar: 5, endBar: 6, level: 0.9, shape: 'flat' },
      ],
      s, yTop, yBottom,
    );
    const dip = pts.slice(2, 5);
    expect(dip).toEqual([[120, 40], [130, 90], [140, 10]]);
    expect(pts[5]).toEqual([140, 10]);
  });
});

describe('movements', () => {
  it('rises for opens and falls for closes', () => {
    expect(movementValue('lowpass_open', 1)).toBeGreaterThan(movementValue('lowpass_open', 0));
    expect(movementValue('lowpass_close', 1)).toBeLessThan(movementValue('lowpass_close', 0));
    expect(movementValue('delay_throw', 0.2)).toBeGreaterThan(movementValue('delay_throw', 0.9));
  });
  it('spans exactly the movement bars and stays inside the block height', () => {
    const pts = movementPoints({ dimension: 'volume', type: 'fade_up', startBar: 2, endBar: 5 }, s, 10, 40);
    expect(pts[0][0]).toBe(barLeft(s, 2));
    expect(pts[pts.length - 1][0]).toBe(barRight(s, 5));
    for (const [, y] of pts) {
      expect(y).toBeGreaterThanOrEqual(10);
      expect(y).toBeLessThanOrEqual(40);
    }
  });
});

describe('chordCells', () => {
  it('holds the root chord for a root segment', () => {
    expect(chordCells({ mode: 'root', startBar: 1, endBar: 16 }, ['Am', 'F', 'C', 'G'])).toEqual([{ symbol: 'Am', startBar: 1, endBar: 16 }]);
  });
  it('cycles the progression and clips the last cell', () => {
    const cells = chordCells({ mode: 'progression', startBar: 17, endBar: 26 }, ['Am', 'F', 'C', 'G'], 4);
    expect(cells.map((c) => c.symbol)).toEqual(['Am', 'F', 'C']);
    expect(cells[2]).toEqual({ symbol: 'C', startBar: 25, endBar: 26 });
  });
});
