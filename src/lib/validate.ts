import {
  EDGE_TYPES,
  ELEMENT_FAMILIES,
  ENERGY_SHAPES,
  FX_TYPES,
  MOVEMENT_DIMENSIONS,
  MOVEMENT_TYPES,
  SECTION_TYPES,
  type MovementDimension,
  type MovementType,
  type Track,
} from '../types/track';

const CHORD_TONES = ['r', '3', '5', '7', '8'];

const DIMENSION_OF: Record<MovementType, MovementDimension> = {
  fade_up: 'volume',
  fade_down: 'volume',
  lowpass_open: 'frequency',
  lowpass_close: 'frequency',
  highpass_open: 'frequency',
  highpass_close: 'frequency',
  reverb_up: 'spatial',
  reverb_down: 'spatial',
  delay_throw: 'spatial',
};

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Returns a list of human-readable problems; empty means the track is safe to render. */
export function validateTrack(raw: unknown): string[] {
  const errors: string[] = [];
  const err = (path: string, msg: string) => errors.push(`${path}: ${msg}`);

  if (!isObj(raw)) return ['root: expected an object'];

  const oneOf = (path: string, v: unknown, allowed: readonly string[]) => {
    if (typeof v !== 'string' || !allowed.includes(v)) err(path, `expected one of ${allowed.join(' | ')}, got ${JSON.stringify(v)}`);
  };
  const num = (path: string, v: unknown): v is number => {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      err(path, `expected a number, got ${JSON.stringify(v)}`);
      return false;
    }
    return true;
  };

  const info = raw.track;
  let totalBars = 0;
  if (!isObj(info)) {
    err('track', 'missing');
  } else {
    for (const k of ['id', 'title', 'artist', 'key']) if (typeof info[k] !== 'string') err(`track.${k}`, 'expected a string');
    if (num('track.bpm', info.bpm) && info.bpm <= 0) err('track.bpm', 'must be positive');
    if (num('track.totalBars', info.totalBars)) totalBars = info.totalBars;
    num('track.firstDownbeatSec', info.firstDownbeatSec);
    if (info.audioUrl !== undefined && typeof info.audioUrl !== 'string') err('track.audioUrl', 'expected a string');
  }

  const range = (path: string, s: unknown, e: unknown, min = 1, max = totalBars): boolean => {
    const okS = num(`${path}.startBar`, s);
    const okE = num(`${path}.endBar`, e);
    if (!okS || !okE) return false;
    if ((s as number) > (e as number)) err(path, `startBar ${s} is after endBar ${e}`);
    if ((s as number) < min || (e as number) > max) err(path, `bars ${s}-${e} outside ${min}-${max}`);
    return true;
  };

  if (!Array.isArray(raw.sections)) err('sections', 'expected an array');
  else {
    let prevEnd = 0;
    raw.sections.forEach((s, i) => {
      const p = `sections[${i}]`;
      if (!isObj(s)) return err(p, 'expected an object');
      oneOf(`${p}.type`, s.type, SECTION_TYPES);
      if (typeof s.label !== 'string') err(`${p}.label`, 'expected a string');
      if (range(p, s.startBar, s.endBar)) {
        if ((s.startBar as number) <= prevEnd) err(p, 'overlaps the previous section');
        prevEnd = s.endBar as number;
      }
    });
  }

  if (!Array.isArray(raw.energy)) err('energy', 'expected an array');
  else
    raw.energy.forEach((e, i) => {
      const p = `energy[${i}]`;
      if (!isObj(e)) return err(p, 'expected an object');
      range(p, e.startBar, e.endBar);
      if (num(`${p}.level`, e.level) && (e.level < 0 || e.level > 1)) err(`${p}.level`, 'must be between 0 and 1');
      oneOf(`${p}.shape`, e.shape, ENERGY_SHAPES);
    });

  const h = raw.harmony;
  if (!isObj(h)) err('harmony', 'missing');
  else {
    if (!Array.isArray(h.progression) || h.progression.length === 0 || h.progression.some((c) => typeof c !== 'string'))
      err('harmony.progression', 'expected a non-empty array of chord names');
    if (h.barsPerChord !== undefined) num('harmony.barsPerChord', h.barsPerChord);
    if (!Array.isArray(h.segments)) err('harmony.segments', 'expected an array');
    else
      h.segments.forEach((s, i) => {
        const p = `harmony.segments[${i}]`;
        if (!isObj(s)) return err(p, 'expected an object');
        oneOf(`${p}.mode`, s.mode, ['root', 'progression']);
        range(p, s.startBar, s.endBar);
      });
  }

  const edge = (path: string, e: unknown) => {
    if (!isObj(e)) return err(path, 'expected an object');
    oneOf(`${path}.type`, e.type, EDGE_TYPES);
    if (e.type !== 'cut' && e.type !== undefined && e.bars === undefined) err(`${path}.bars`, `${String(e.type)} needs a bar length`);
    if (e.bars !== undefined) num(`${path}.bars`, e.bars);
  };

  const ids = new Set<string>();
  if (!Array.isArray(raw.elements)) err('elements', 'expected an array');
  else
    raw.elements.forEach((el, i) => {
      const p = `elements[${i}]`;
      if (!isObj(el)) return err(p, 'expected an object');
      if (typeof el.id !== 'string') err(`${p}.id`, 'expected a string');
      else if (ids.has(el.id)) err(`${p}.id`, `duplicate id ${el.id}`);
      else ids.add(el.id);
      if (typeof el.name !== 'string') err(`${p}.name`, 'expected a string');
      oneOf(`${p}.family`, el.family, ELEMENT_FAMILIES);
      const wantKind = el.family === 'kick' || el.family === 'drums' ? 'hits' : 'notes';
      const patterns = isObj(el.patterns) ? el.patterns : {};
      if (el.patterns !== undefined && !isObj(el.patterns)) err(`${p}.patterns`, 'expected an object');
      for (const [pid, pat] of Object.entries(patterns)) {
        const pp = `${p}.patterns.${pid}`;
        if (!isObj(pat)) { err(pp, 'expected an object'); continue; }
        if (pat.kind !== 'hits' && pat.kind !== 'notes') { err(`${pp}.kind`, 'expected hits | notes'); continue; }
        if (el.family === 'fx') err(pp, 'fx elements do not take patterns');
        else if (pat.kind !== wantKind) err(pp, `a ${String(el.family)} element takes ${wantKind} patterns`);
        const len = pat.lengthBars === undefined ? 1 : pat.lengthBars;
        if (typeof len !== 'number' || len < 1 || !Number.isInteger(len)) err(`${pp}.lengthBars`, 'expected a whole number of bars');
        const maxStep = (typeof len === 'number' ? len : 1) * 16;
        if (pat.kind === 'hits') {
          if (!isObj(pat.voices) || Object.keys(pat.voices).length === 0) err(`${pp}.voices`, 'expected at least one voice');
          else
            for (const [v, steps] of Object.entries(pat.voices)) {
              if (!Array.isArray(steps) || steps.some((n) => !Number.isInteger(n) || n < 0 || n >= maxStep)) err(`${pp}.voices.${v}`, `steps must be whole numbers 0-${maxStep - 1}`);
            }
        } else if (!Array.isArray(pat.notes) || pat.notes.length === 0) err(`${pp}.notes`, 'expected at least one note');
        else
          pat.notes.forEach((n, k) => {
            const np = `${pp}.notes[${k}]`;
            if (!isObj(n)) return err(np, 'expected an object');
            if (!Number.isInteger(n.step) || (n.step as number) < 0 || (n.step as number) >= maxStep) err(`${np}.step`, `expected a whole number 0-${maxStep - 1}`);
            if (typeof n.len !== 'number' || n.len <= 0) err(`${np}.len`, 'expected a positive length in steps');
            const tones = Array.isArray(n.tone) ? n.tone : [n.tone];
            if (tones.length === 0 || tones.some((t) => !CHORD_TONES.includes(t as never))) err(`${np}.tone`, `expected ${CHORD_TONES.join(' | ')} or a list of them`);
          });
      }
      if (!Array.isArray(el.blocks)) return err(`${p}.blocks`, 'expected an array');
      el.blocks.forEach((b, j) => {
        const bp = `${p}.blocks[${j}]`;
        if (!isObj(b)) return err(bp, 'expected an object');
        const ok = range(bp, b.startBar, b.endBar);
        if (num(`${bp}.confidence`, b.confidence) && (b.confidence < 0 || b.confidence > 1)) err(`${bp}.confidence`, 'must be between 0 and 1');
        edge(`${bp}.entry`, b.entry);
        edge(`${bp}.exit`, b.exit);
        if (b.pattern !== undefined && (typeof b.pattern !== 'string' || !(b.pattern in patterns))) err(`${bp}.pattern`, `unknown pattern ${JSON.stringify(b.pattern)}`);
        if (b.overrides !== undefined) {
          if (!Array.isArray(b.overrides)) return err(`${bp}.overrides`, 'expected an array');
          b.overrides.forEach((o, k) => {
            const op = `${bp}.overrides[${k}]`;
            if (!isObj(o)) return err(op, 'expected an object');
            if (typeof o.pattern !== 'string' || !(o.pattern in patterns)) err(`${op}.pattern`, `unknown pattern ${JSON.stringify(o.pattern)}`);
            if (range(op, o.startBar, o.endBar) && ok && ((o.startBar as number) < (b.startBar as number) || (o.endBar as number) > (b.endBar as number))) err(op, 'runs outside its block');
          });
        }
        if (b.movements !== undefined) {
          if (!Array.isArray(b.movements)) return err(`${bp}.movements`, 'expected an array');
          b.movements.forEach((m, k) => {
            const mp = `${bp}.movements[${k}]`;
            if (!isObj(m)) return err(mp, 'expected an object');
            oneOf(`${mp}.dimension`, m.dimension, MOVEMENT_DIMENSIONS);
            oneOf(`${mp}.type`, m.type, MOVEMENT_TYPES);
            if (typeof m.type === 'string' && m.type in DIMENSION_OF && DIMENSION_OF[m.type as MovementType] !== m.dimension)
              err(mp, `${m.type} belongs to dimension ${DIMENSION_OF[m.type as MovementType]}, not ${String(m.dimension)}`);
            if (range(mp, m.startBar, m.endBar) && ok && ((m.startBar as number) < (b.startBar as number) || (m.endBar as number) > (b.endBar as number)))
              err(mp, 'runs outside its block');
          });
        }
      });
    });

  if (!Array.isArray(raw.fxEvents)) err('fxEvents', 'expected an array');
  else
    raw.fxEvents.forEach((f, i) => {
      const p = `fxEvents[${i}]`;
      if (!isObj(f)) return err(p, 'expected an object');
      oneOf(`${p}.type`, f.type, FX_TYPES);
      if (f.bar !== undefined) {
        if (num(`${p}.bar`, f.bar) && (f.bar < 1 || f.bar > totalBars)) err(`${p}.bar`, `outside 1-${totalBars}`);
      } else range(p, f.startBar, f.endBar);
    });

  return errors;
}

export function parseTrack(raw: unknown): Track {
  const errors = validateTrack(raw);
  if (errors.length > 0) throw new Error(`Invalid track JSON:\n - ${errors.join('\n - ')}`);
  return raw as Track;
}
