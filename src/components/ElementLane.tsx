import { barLeft, barRight, blockPolygon, fadeStops, movementPoints, toPath, toPoints, type Point, type Scale } from '../lib/geometry';
import { chordAtBar } from '../lib/chords';
import { BASE_OCTAVE, HEAD_H, STRIP_H, type LaneMetrics } from '../lib/layout';
import { expandHits, expandNotes, pitchShifts } from '../lib/patterns';
import { DAW, FAMILY_FLAT, lighten } from '../lib/theme';
import { LOW_CONFIDENCE, type Block, type Element, type ElementFamily, type FxEvent, type Harmony, type Movement, type MovementDimension, type MovementType } from '../types/track';

interface LaneProps {
  element?: Element;
  family: ElementFamily;
  metrics: LaneMetrics;
  harmony: Harmony;
  totalBars: number;
  events?: FxEvent[];
  scale: Scale;
  y: number;
}

const MOVEMENT_COLOR: Record<MovementDimension, string> = { volume: '#FFFFFF', frequency: '#FFE066', spatial: '#7AF0FF' };
const MOVEMENT_LABEL: Record<MovementType, string> = {
  fade_up: 'fade up',
  fade_down: 'fade down',
  lowpass_open: 'LP open',
  lowpass_close: 'LP close',
  highpass_open: 'HP open',
  highpass_close: 'HP close',
  reverb_up: 'reverb up',
  reverb_down: 'reverb down',
  delay_throw: 'delay throw',
};

export function ElementLane({ element, family, metrics, harmony, totalBars, events = [], scale, y }: LaneProps) {
  const isFx = metrics.kind === 'fx';
  const notesTop = isFx ? y + 30 : y + HEAD_H + 2;
  const notesBot = isFx ? y + metrics.h - 4 : notesTop + metrics.notesH;
  const stripTop = notesBot + 4;
  const x0 = barLeft(scale, 1);
  const x1 = barRight(scale, totalBars);

  // Octave guides (every C) make pitch shifts readable across the whole lane.
  const guides: number[] = [];
  if (metrics.kind === 'notes') {
    const rows = metrics.pitchMax - metrics.pitchMin + 1;
    const rowH = Math.min(7, metrics.notesH / rows);
    const offset = (metrics.notesH - rowH * rows) / 2;
    for (let p = metrics.pitchMin; p <= metrics.pitchMax; p++) if (p % 12 === 0) guides.push(notesTop + offset + (metrics.pitchMax - p) * rowH + rowH / 2);
  }

  return (
    <g>
      {guides.map((gy) => <line key={gy} x1={x0} x2={x1} y1={gy} y2={gy} stroke="#fff" strokeOpacity={0.09} strokeDasharray="1 3" shapeRendering="crispEdges" />)}
      {metrics.strip && <rect x={x0} y={stripTop} width={x1 - x0} height={STRIP_H} fill={DAW.line} opacity={0.6} />}
      {(element?.blocks ?? []).map((b, i) => (
        <BlockShape key={i} id={`${family}-${i}`} block={b} element={element!} family={family} metrics={metrics} harmony={harmony} scale={scale} y={y} top={notesTop} bot={notesBot} stripTop={stripTop} name={element?.name ?? family} />
      ))}
      {events.map((e, i) => <FxMarker key={i} event={e} scale={scale} top={y + 4} bot={y + 28} />)}
    </g>
  );
}

interface BlockProps { id: string; block: Block; element: Element; family: ElementFamily; metrics: LaneMetrics; harmony: Harmony; scale: Scale; y: number; top: number; bot: number; stripTop: number; name: string }

/** One small rectangle per event, merged into a single path so a clip stays one DOM node. */
const rect = (x: number, y: number, w: number, h: number) => `M${x.toFixed(1)},${y.toFixed(1)}h${w.toFixed(1)}v${h.toFixed(1)}h-${w.toFixed(1)}z`;

function BlockShape({ id, block, element, family, metrics, harmony, scale, y, top, bot, stripTop, name }: BlockProps) {
  const isFx = metrics.kind === 'fx';
  const x0 = barLeft(scale, block.startBar);
  const x1 = barRight(scale, block.endBar);
  const ppb = scale.ppb;
  const color = FAMILY_FLAT[family];
  const poly = blockPolygon(x0, x1, top, bot, block.entry, block.exit, ppb);
  const low = block.confidence < LOW_CONFIDENCE;
  const fades = fadeStops(x0, x1, block.entry, block.exit, ppb);
  const hasFade = fades.entry > 0 || fades.exit > 0;
  const w = x1 - x0;
  const wedgeW = (bars = 0) => Math.min(bars * ppb, w / 2);
  const noteAt = (pos: number) => scale.x0 + pos * ppb;

  let layer = '';
  let connectors = '';
  let chordMarks = '';
  const detailed = !!block.pattern && (metrics.kind === 'hits' || metrics.kind === 'notes');

  if (block.pattern && metrics.kind === 'hits') {
    const rowH = (bot - top) / metrics.voices.length;
    const tickW = Math.max((ppb / 16) * 0.7, 1);
    layer = expandHits(element, block)
      .map((e) => rect(noteAt(e.pos), top + metrics.voices.indexOf(e.voice) * rowH + 1, tickW, Math.max(rowH - 2, 2)))
      .join('');
  } else if (block.pattern && metrics.kind === 'notes') {
    const rows = metrics.pitchMax - metrics.pitchMin + 1;
    const rowH = Math.min(7, (bot - top) / rows);
    const offset = (bot - top - rowH * rows) / 2;
    const yOf = (pitch: number) => top + offset + (metrics.pitchMax - pitch) * rowH;
    const events = expandNotes(element, block, harmony, BASE_OCTAVE[family] ?? 4);
    const nh = Math.max(rowH - 0.6, 3);
    layer = events.map((e) => rect(noteAt(e.pos), yOf(e.pitch), Math.max(e.len * ppb - 0.6, 1), nh)).join('');
    if (ppb >= 12) {
      connectors = pitchShifts(events)
        .map((s) => `M${noteAt(s.from).toFixed(1)},${(yOf(s.p1) + nh / 2).toFixed(1)}L${noteAt(s.to).toFixed(1)},${(yOf(s.p2) + nh / 2).toFixed(1)}`)
        .join('');
    }
    for (let b = block.startBar + 1; b <= block.endBar; b++) {
      if (chordAtBar(harmony, b) !== chordAtBar(harmony, b - 1)) chordMarks += `M${barLeft(scale, b).toFixed(1)},${top}V${bot}`;
    }
  }

  const edgeLines: Array<{ a: Point; b: Point }> = [];
  if (block.entry.type === 'highpass_sweep') edgeLines.push({ a: poly[0], b: poly[3] });
  if (block.entry.type === 'lowpass_sweep') edgeLines.push({ a: poly[3], b: poly[0] });
  if (block.exit.type === 'highpass_sweep') edgeLines.push({ a: poly[1], b: poly[2] });
  if (block.exit.type === 'lowpass_sweep') edgeLines.push({ a: poly[2], b: poly[1] });

  const fadeRamps: Array<{ a: Point; b: Point }> = [];
  if (block.entry.type === 'fade') fadeRamps.push({ a: [x0, bot], b: [x0 + wedgeW(block.entry.bars), top] });
  if (block.exit.type === 'fade') fadeRamps.push({ a: [x1 - wedgeW(block.exit.bars), top], b: [x1, bot] });

  const washes: Array<{ x: number; w: number }> = [];
  if (block.entry.type === 'reverb_wash') washes.push({ x: x0, w: wedgeW(block.entry.bars) });
  if (block.exit.type === 'reverb_wash') washes.push({ x: x1 - wedgeW(block.exit.bars), w: wedgeW(block.exit.bars) });

  // Clip name strip: the pattern it plays, and each override where it starts.
  const labels: Array<{ x: number; text: string }> = [];
  if (!isFx) {
    labels.push({ x: x0 + 5, text: block.pattern ?? name });
    for (const o of block.overrides ?? []) labels.push({ x: barLeft(scale, o.startBar) + 5, text: o.pattern });
    labels.sort((a, b) => a.x - b.x);
  }

  const tip = `${name} · bars ${block.startBar}–${block.endBar}${block.pattern ? ` · ${block.pattern}` : ''}`;
  const bodyOpacity = low ? 0.35 : isFx ? 0.75 : 1;

  return (
    <g className="block-g" data-element={name} data-start={block.startBar} data-end={block.endBar} data-confidence={block.confidence}>
      <title>{tip}</title>
      {hasFade && (
        <>
          <linearGradient id={`fg-${id}`} gradientUnits="userSpaceOnUse" x1={x0} y1={0} x2={x1} y2={0}>
            <stop offset={0} stopColor="#fff" stopOpacity={fades.entry > 0 ? 0.08 : 1} />
            <stop offset={fades.entry} stopColor="#fff" stopOpacity={1} />
            <stop offset={1 - fades.exit} stopColor="#fff" stopOpacity={1} />
            <stop offset={1} stopColor="#fff" stopOpacity={fades.exit > 0 ? 0.08 : 1} />
          </linearGradient>
          <mask id={`m-${id}`} maskUnits="userSpaceOnUse" x={x0 - 4} y={top - 2} width={w + 8} height={bot - top + 4}>
            <rect x={x0 - 4} y={top - 2} width={w + 8} height={bot - top + 4} fill={`url(#fg-${id})`} />
          </mask>
        </>
      )}

      {!isFx && (
        <g className="mark dim-time">
          <rect x={x0} y={y} width={w} height={HEAD_H} rx={2} fill={lighten(color, 0.3)} opacity={low ? 0.5 : 1} />
          {labels.map((l, i) => {
            const next = labels[i + 1]?.x ?? x1;
            return next - l.x > l.text.length * 5.4 + 8 ? <text key={i} className="clip-name" x={l.x} y={y + 9}>{l.text}</text> : null;
          })}
          {(block.overrides ?? []).map((o) => <line key={o.startBar} x1={barLeft(scale, o.startBar)} x2={barLeft(scale, o.startBar)} y1={y} y2={y + HEAD_H} stroke={DAW.line} strokeOpacity={0.7} shapeRendering="crispEdges" />)}
        </g>
      )}

      <g mask={hasFade ? `url(#m-${id})` : undefined}>
        <g className="mark dim-time">
          <polygon points={toPoints(poly)} fill={color} fillOpacity={bodyOpacity} stroke={DAW.line} strokeWidth={1} strokeLinejoin="round" />
          {low && <polygon points={toPoints(poly)} fill="none" stroke="#fff" strokeOpacity={0.9} strokeWidth={1.3} strokeDasharray="4 3" strokeLinejoin="round" />}
        </g>
        {detailed && <path className="mark dim-time" d={layer} fill={DAW.note} opacity={low ? 0.7 : 0.9} />}
        {chordMarks && <path className="mark dim-harmony" d={chordMarks} stroke={DAW.note} strokeOpacity={0.4} strokeDasharray="2 2" fill="none" shapeRendering="crispEdges" />}
        {connectors && <path className="mark dim-harmony" d={connectors} stroke={DAW.note} strokeWidth={1.1} strokeOpacity={0.75} fill="none" />}
        {washes.map((s, i) => <rect key={`w${i}`} className="mark dim-spatial" x={s.x} y={top} width={s.w} height={bot - top} fill="#fff" opacity={0.3} />)}
      </g>
      {edgeLines.map((l, i) => <line key={`e${i}`} className="mark dim-frequency" x1={l.a[0]} y1={l.a[1]} x2={l.b[0]} y2={l.b[1]} stroke="#fff" strokeWidth={1.4} strokeLinecap="round" opacity={0.85} />)}
      {fadeRamps.map((l, i) => <line key={`f${i}`} className="mark dim-volume" x1={l.a[0]} y1={l.a[1]} x2={l.b[0]} y2={l.b[1]} stroke="#fff" strokeWidth={1} strokeLinecap="round" opacity={0.45} />)}
      {metrics.strip && (block.movements ?? []).map((m, i) => <MovementCurve key={i} m={m} scale={scale} top={stripTop + 3} bot={stripTop + STRIP_H - 3} />)}
    </g>
  );
}

/** A movement inside a block, drawn in the automation strip: filled curve, end points, and its name. */
function MovementCurve({ m, scale, top, bot }: { m: Movement; scale: Scale; top: number; bot: number }) {
  const pts = movementPoints(m, scale, top, bot);
  const line = toPath(pts);
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${bot + 3} L${pts[0][0].toFixed(1)},${bot + 3} Z`;
  const color = MOVEMENT_COLOR[m.dimension];
  const first = pts[0];
  const last = pts[pts.length - 1];
  const label = MOVEMENT_LABEL[m.type];
  const w = last[0] - first[0];
  return (
    <g className={`mark dim-${m.dimension}`} data-movement={m.type}>
      <title>{`${label} · bars ${m.startBar}–${m.endBar}`}</title>
      <path d={area} fill={color} opacity={0.16} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={m.dimension === 'spatial' ? '4 3' : undefined} />
      <circle cx={first[0]} cy={first[1]} r={2.2} fill={color} />
      <circle cx={last[0]} cy={last[1]} r={2.2} fill={color} />
      {w > label.length * 5.2 + 12 && <text className="move-label" x={first[0] + 6} y={bot + 1} fill={color}>{label}</text>}
    </g>
  );
}

function starPoints(cx: number, cy: number, R: number): string {
  const r = R * 0.45;
  const pts: Point[] = [];
  for (let i = 0; i < 16; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = (i * Math.PI) / 8 - Math.PI / 2;
    pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
  }
  return toPoints(pts);
}

function FxMarker({ event, scale, top, bot }: { event: FxEvent; scale: Scale; top: number; bot: number }) {
  const label = event.type.replace('_', ' ');
  if (event.type === 'crash' || event.type === 'impact') {
    const bar = event.bar ?? event.startBar ?? 1;
    const cx = barLeft(scale, bar) + scale.ppb / 2;
    const cy = (top + bot) / 2;
    return (
      <g className="block-g mark dim-fx" data-fx={event.type} data-start={bar}>
        <title>{`${label} · bar ${bar}`}</title>
        {event.type === 'crash' ? <polygon points={starPoints(cx, cy, 11)} fill="#FFE9A8" /> : <circle cx={cx} cy={cy} r={4.5} fill="#F0509A" stroke="#fff" strokeWidth={1.4} />}
      </g>
    );
  }
  const s = event.startBar ?? event.bar ?? 1;
  const e = event.endBar ?? s;
  const x0 = barLeft(scale, s);
  const x1 = barRight(scale, e);
  const rising = event.type !== 'downlifter';
  const pts: Point[] = rising ? [[x0, bot], [x1, top], [x1, bot]] : [[x0, top], [x1, bot], [x0, bot]];
  const ghost = event.type === 'reverse_cymbal';
  return (
    <g className="block-g mark dim-fx" data-fx={event.type} data-start={s} data-end={e}>
      <title>{`${label} · bars ${s}–${e}`}</title>
      <polygon points={toPoints(pts)} fill={FAMILY_FLAT.fx} fillOpacity={ghost ? 0.35 : 1} stroke={DAW.line} strokeLinejoin="round" />
      {ghost && <polygon points={toPoints(pts)} fill="none" stroke="#fff" strokeWidth={1.2} strokeDasharray="3 2" strokeLinejoin="round" />}
    </g>
  );
}
