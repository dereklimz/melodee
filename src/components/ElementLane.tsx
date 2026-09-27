import { barLeft, barRight, blockPolygon, fadeStops, movementPoints, toPath, toPoints, type Point, type Scale } from '../lib/geometry';
import { BASE_OCTAVE, STRIP_H, type LaneMetrics } from '../lib/layout';
import { expandHits, expandNotes } from '../lib/patterns';
import { FAMILY_GRADIENT } from '../lib/theme';
import { LOW_CONFIDENCE, type Block, type Element, type ElementFamily, type FxEvent, type Harmony, type Movement } from '../types/track';

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

export function ElementLane({ element, family, metrics, harmony, totalBars, events = [], scale, y }: LaneProps) {
  const isFx = metrics.kind === 'fx';
  const notesTop = isFx ? y + 30 : y + 6;
  const notesBot = isFx ? y + metrics.h - 4 : y + 6 + metrics.notesH;
  const stripTop = notesBot + 6;
  const x0 = barLeft(scale, 1);
  const x1 = barRight(scale, totalBars);
  return (
    <g>
      {metrics.strip && <rect x={x0} y={stripTop} width={x1 - x0} height={STRIP_H} rx={5} fill="#14164A" opacity={0.4} />}
      {(element?.blocks ?? []).map((b, i) => (
        <BlockShape key={i} id={`${family}-${i}`} block={b} element={element!} family={family} metrics={metrics} harmony={harmony} scale={scale} top={notesTop} bot={notesBot} stripTop={stripTop} name={element?.name ?? family} />
      ))}
      {events.map((e, i) => (
        <FxMarker key={i} event={e} scale={scale} top={y + 4} bot={y + 28} />
      ))}
    </g>
  );
}

interface BlockProps { id: string; block: Block; element: Element; family: ElementFamily; metrics: LaneMetrics; harmony: Harmony; scale: Scale; top: number; bot: number; stripTop: number; name: string }

/** Path of one small rectangle per event, merged into a single string so a block is one DOM node. */
const rect = (x: number, y: number, w: number, h: number) => `M${x.toFixed(1)},${y.toFixed(1)}h${w.toFixed(1)}v${h.toFixed(1)}h-${w.toFixed(1)}z`;

function BlockShape({ id, block, element, family, metrics, harmony, scale, top, bot, stripTop, name }: BlockProps) {
  const x0 = barLeft(scale, block.startBar) + 1;
  const x1 = barRight(scale, block.endBar) - 1;
  const ppb = scale.ppb;
  const inset = 1.5;
  const poly = blockPolygon(x0, x1, top + inset, bot - inset, block.entry, block.exit, ppb);
  const low = block.confidence < LOW_CONFIDENCE;
  const fades = fadeStops(x0, x1, block.entry, block.exit, ppb);
  const hasFade = fades.entry > 0 || fades.exit > 0;
  const grad = `url(#g-${family})`;
  const noteColor = FAMILY_GRADIENT[family][0];
  const w = x1 - x0;
  const wedgeW = (bars = 0) => Math.min(bars * ppb, w / 2);

  // What the block plays: hits (drums) or notes (melodic), drawn over a faint backdrop.
  let layer = '';
  if (block.pattern && metrics.kind === 'hits') {
    const rowH = (bot - top) / metrics.voices.length;
    const tickW = Math.max((ppb / 16) * 0.7, 1);
    layer = expandHits(element, block)
      .map((e) => rect(barLeft(scale, 1) + e.pos * ppb, top + metrics.voices.indexOf(e.voice) * rowH + 1, tickW, Math.max(rowH - 2, 2)))
      .join('');
  } else if (block.pattern && metrics.kind === 'notes') {
    const rows = metrics.pitchMax - metrics.pitchMin + 1;
    const rowH = Math.min(6, (bot - top) / rows);
    const offset = (bot - top - rowH * rows) / 2;
    layer = expandNotes(element, block, harmony, BASE_OCTAVE[family] ?? 4)
      .map((e) => rect(barLeft(scale, 1) + e.pos * ppb, top + offset + (metrics.pitchMax - e.pitch) * rowH, Math.max(e.len * ppb - 0.6, 1), Math.max(rowH - 0.6, 2.4)))
      .join('');
  }
  const detailed = layer !== '';

  const edgeLines: Array<{ a: Point; b: Point }> = [];
  if (block.entry.type === 'highpass_sweep') edgeLines.push({ a: poly[0], b: poly[3] });
  if (block.entry.type === 'lowpass_sweep') edgeLines.push({ a: poly[3], b: poly[0] });
  if (block.exit.type === 'highpass_sweep') edgeLines.push({ a: poly[1], b: poly[2] });
  if (block.exit.type === 'lowpass_sweep') edgeLines.push({ a: poly[2], b: poly[1] });

  const fadeRamps: Array<{ a: Point; b: Point }> = [];
  if (block.entry.type === 'fade') fadeRamps.push({ a: [x0, bot - inset], b: [x0 + wedgeW(block.entry.bars), top + inset] });
  if (block.exit.type === 'fade') fadeRamps.push({ a: [x1 - wedgeW(block.exit.bars), top + inset], b: [x1, bot - inset] });

  const washes: Array<{ x: number; w: number }> = [];
  if (block.entry.type === 'reverb_wash') washes.push({ x: x0, w: wedgeW(block.entry.bars) });
  if (block.exit.type === 'reverb_wash') washes.push({ x: x1 - wedgeW(block.exit.bars), w: wedgeW(block.exit.bars) });

  const tip = `${name} · bars ${block.startBar}–${block.endBar}${block.pattern ? ` · ${block.pattern}` : ''}`;
  const backOpacity = detailed ? (low ? 0.1 : 0.2) : low ? 0.3 : 0.8;

  return (
    <g className="block-g" data-element={name} data-start={block.startBar} data-end={block.endBar} data-confidence={block.confidence}>
      <title>{tip}</title>
      {hasFade && (
        <>
          <linearGradient id={`fg-${id}`} gradientUnits="userSpaceOnUse" x1={x0} y1={0} x2={x1} y2={0}>
            <stop offset={0} stopColor="#fff" stopOpacity={fades.entry > 0 ? 0.05 : 1} />
            <stop offset={fades.entry} stopColor="#fff" stopOpacity={1} />
            <stop offset={1 - fades.exit} stopColor="#fff" stopOpacity={1} />
            <stop offset={1} stopColor="#fff" stopOpacity={fades.exit > 0 ? 0.05 : 1} />
          </linearGradient>
          <mask id={`m-${id}`} maskUnits="userSpaceOnUse" x={x0 - 4} y={top - 2} width={w + 8} height={bot - top + 4}>
            <rect x={x0 - 4} y={top - 2} width={w + 8} height={bot - top + 4} fill={`url(#fg-${id})`} />
          </mask>
        </>
      )}
      <g mask={hasFade ? `url(#m-${id})` : undefined}>
        <g className="mark dim-time">
          <polygon points={toPoints(poly)} fill={grad} stroke={grad} strokeWidth={3} strokeLinejoin="round" fillOpacity={backOpacity} strokeOpacity={backOpacity} />
          {low && <polygon points={toPoints(poly)} fill="none" stroke="#fff" strokeOpacity={0.9} strokeWidth={1.4} strokeDasharray="4 3" strokeLinejoin="round" />}
        </g>
        {detailed && <path className="mark dim-time" d={layer} fill={noteColor} opacity={low ? 0.8 : 1} />}
        {washes.map((s, i) => (
          <rect key={`w${i}`} className="mark dim-spatial" x={s.x} y={top + inset} width={s.w} height={bot - top - inset * 2} rx={4} fill="#fff" opacity={0.28} filter="url(#f-blur)" />
        ))}
      </g>
      {edgeLines.map((l, i) => (
        <line key={`e${i}`} className="mark dim-frequency" x1={l.a[0]} y1={l.a[1]} x2={l.b[0]} y2={l.b[1]} stroke="#fff" strokeWidth={1.3} strokeLinecap="round" opacity={0.65} />
      ))}
      {fadeRamps.map((l, i) => (
        <line key={`f${i}`} className="mark dim-volume" x1={l.a[0]} y1={l.a[1]} x2={l.b[0]} y2={l.b[1]} stroke="#fff" strokeWidth={1} strokeLinecap="round" opacity={0.35} />
      ))}
      {metrics.strip && (block.movements ?? []).map((m, i) => <MovementCurve key={i} m={m} scale={scale} top={stripTop + 2} bot={stripTop + STRIP_H - 2} />)}
    </g>
  );
}

function MovementCurve({ m, scale, top, bot }: { m: Movement; scale: Scale; top: number; bot: number }) {
  const pts = movementPoints(m, scale, top, bot);
  const d = toPath(pts);
  const dash = m.dimension === 'spatial' ? '3 3' : undefined;
  const first = pts[0];
  const last = pts[pts.length - 1];
  return (
    <g className={`mark dim-${m.dimension}`} data-movement={m.type}>
      <path d={d} fill="none" stroke="#14164A" strokeOpacity={0.3} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#fff" strokeOpacity={0.9} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} />
      {m.dimension === 'frequency' && (
        <>
          <circle cx={first[0]} cy={first[1]} r={2} fill="#fff" />
          <circle cx={last[0]} cy={last[1]} r={2} fill="#fff" />
        </>
      )}
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
        {event.type === 'crash' ? (
          <polygon points={starPoints(cx, cy, 11)} fill="#FFE9A8" filter="url(#f-glow)" />
        ) : (
          <circle cx={cx} cy={cy} r={4.5} fill="#F0509A" stroke="#fff" strokeWidth={1.6} />
        )}
      </g>
    );
  }
  const s = event.startBar ?? event.bar ?? 1;
  const e = event.endBar ?? s;
  const x0 = barLeft(scale, s) + 1;
  const x1 = barRight(scale, e) - 1;
  const rising = event.type !== 'downlifter';
  const pts: Point[] = rising ? [[x0, bot], [x1, top], [x1, bot]] : [[x0, top], [x1, bot], [x0, bot]];
  const ghost = event.type === 'reverse_cymbal';
  return (
    <g className="block-g mark dim-fx" data-fx={event.type} data-start={s} data-end={e}>
      <title>{`${label} · bars ${s}–${e}`}</title>
      <polygon points={toPoints(pts)} fill="url(#g-fx)" stroke="url(#g-fx)" strokeWidth={2} strokeLinejoin="round" fillOpacity={ghost ? 0.3 : 0.8} strokeOpacity={ghost ? 0.3 : 0.8} />
      {ghost && <polygon points={toPoints(pts)} fill="none" stroke="#fff" strokeWidth={1.2} strokeDasharray="3 2" strokeLinejoin="round" />}
    </g>
  );
}
