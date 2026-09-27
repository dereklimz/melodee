import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTrack, validateTrack } from './validate';
import { barToSeconds, formatTime, trackLength } from './time';

const load = (id: string) => JSON.parse(readFileSync(`public/tracks/${id}.json`, 'utf8'));

describe('shipped mock tracks', () => {
  const ids: string[] = JSON.parse(readFileSync('public/tracks/index.json', 'utf8'));

  it.each(ids)('%s is valid', (id) => {
    expect(validateTrack(load(id))).toEqual([]);
  });

  it.each(ids)('%s covers every bar with sections, energy and harmony', (id) => {
    const t = parseTrack(load(id));
    for (const [name, segs] of [['sections', t.sections], ['energy', t.energy], ['harmony', t.harmony.segments]] as const) {
      const sorted = [...segs].sort((a, b) => a.startBar - b.startBar);
      expect(sorted[0].startBar, `${id} ${name} start`).toBe(1);
      expect(sorted[sorted.length - 1].endBar, `${id} ${name} end`).toBe(t.track.totalBars);
      sorted.slice(1).forEach((s, i) => expect(s.startBar, `${id} ${name} gap`).toBe(sorted[i].endBar + 1));
    }
  });

  it.each(ids)('%s has a low-confidence block, a wedge, a movement and an fx event', (id) => {
    const t = parseTrack(load(id));
    const blocks = t.elements.flatMap((e) => e.blocks);
    expect(blocks.some((b) => b.confidence < 0.6)).toBe(true);
    expect(blocks.some((b) => b.entry.type.endsWith('sweep') || b.exit.type.endsWith('sweep'))).toBe(true);
    expect(blocks.some((b) => (b.movements ?? []).length > 0)).toBe(true);
    expect(t.fxEvents.length).toBeGreaterThan(0);
  });
});

describe('validateTrack', () => {
  it('names the path of a bad field', () => {
    const t = load('demo-01');
    t.elements[2].blocks[0].entry.type = 'wobble';
    expect(validateTrack(t).join('\n')).toContain('elements[2].blocks[0].entry.type');
  });
  it('rejects a movement that runs outside its block', () => {
    const t = load('demo-01');
    t.elements[0].blocks[0].movements[0].endBar = 60;
    expect(validateTrack(t).join('\n')).toContain('runs outside its block');
  });
  it('rejects a movement whose type belongs to another dimension', () => {
    const t = load('demo-01');
    t.elements[0].blocks[0].movements[0].dimension = 'spatial';
    expect(validateTrack(t).join('\n')).toContain('belongs to dimension frequency');
  });
  it('rejects overlapping sections and a sweep with no length', () => {
    const t = load('demo-01');
    t.sections[1].startBar = 10;
    delete t.elements[2].blocks[0].entry.bars;
    const msg = validateTrack(t).join('\n');
    expect(msg).toContain('overlaps the previous section');
    expect(msg).toContain('needs a bar length');
  });
  it('parseTrack throws with every problem listed', () => {
    expect(() => parseTrack({})).toThrow(/Invalid track JSON/);
  });
});

describe('time helpers', () => {
  it('converts bars to seconds from the first downbeat', () => {
    const t = { bpm: 120, firstDownbeatSec: 0.5, totalBars: 32 };
    expect(barToSeconds(t, 1)).toBe(0.5);
    expect(barToSeconds(t, 3)).toBeCloseTo(4.5);
    expect(trackLength(t)).toBe('1:04');
    expect(formatTime(243.8)).toBe('4:04');
  });
});

describe('patterns', () => {
  it('rejects a block that points at a missing pattern', () => {
    const t = load('demo-01');
    t.elements[0].blocks[0].pattern = 'nope';
    expect(validateTrack(t).join('\n')).toContain('unknown pattern');
  });
  it('rejects hit steps outside the pattern and note patterns on a drum element', () => {
    const t = load('demo-01');
    t.elements[0].patterns.four.voices.kick = [0, 16];
    t.elements[1].patterns.groove = { kind: 'notes', notes: [{ step: 0, len: 1, tone: 'r' }] };
    const msg = validateTrack(t).join('\n');
    expect(msg).toContain('steps must be whole numbers 0-15');
    expect(msg).toContain('takes hits patterns');
  });
  it('rejects an override outside its block', () => {
    const t = load('demo-01');
    t.elements[0].blocks[0].overrides = [{ startBar: 30, endBar: 90, pattern: 'four' }];
    expect(validateTrack(t).join('\n')).toContain('runs outside its block');
  });
  it.each(['demo-01', 'demo-02', 'demo-03'])('%s: every non-fx block plays a pattern', (id) => {
    const t = parseTrack(load(id));
    for (const el of t.elements.filter((e) => e.family !== 'fx')) for (const b of el.blocks) expect(b.pattern, `${id} ${el.id} ${b.startBar}`).toBeDefined();
  });
});
