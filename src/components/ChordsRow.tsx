import { barLeft, barRight, chordCells, type Scale } from '../lib/geometry';
import { CHORD_OCTAVE } from '../lib/layout';
import { parseChord, tonePitch } from '../lib/chords';
import type { Harmony } from '../types/track';

interface Props { harmony: Harmony; pitchRange: { min: number; max: number }; scale: Scale; y: number; h: number }

const CHAR_W = 7;
const fits = (text: string, w: number) => w >= text.length * CHAR_W + 8;
const LABEL_H = 15;

/**
 * The chord row as a mini piano roll: each chord is drawn as its three notes, held for
 * as long as the chord lasts, so root sections read as long flat bars and progressions
 * as notes stepping up and down. Symbols sit above the notes.
 */
export function ChordsRow({ harmony, pitchRange, scale, y, h }: Props) {
  const per = harmony.barsPerChord ?? 2;
  const summary = harmony.progression.join(' · ');
  const top = y + LABEL_H + 2;
  const areaH = h - LABEL_H - 6;
  const rows = pitchRange.max - pitchRange.min + 1;
  const rowH = Math.min(5, areaH / rows);
  const offset = (areaH - rowH * rows) / 2;
  const noteY = (pitch: number) => top + offset + (pitchRange.max - pitch) * rowH;

  return (
    <g className="mark dim-harmony">
      {harmony.segments.map((seg, si) => {
        const cells = chordCells(seg, harmony.progression, per);
        const x0 = barLeft(scale, seg.startBar) + 1;
        const x1 = barRight(scale, seg.endBar) - 1;
        const w = x1 - x0;
        const root = seg.mode === 'root';
        const cellsFit = !root && cells.every((c) => fits(c.symbol, (c.endBar - c.startBar + 1) * scale.ppb - 2));
        const d = cells
          .map((c) => {
            const cx0 = barLeft(scale, c.startBar) + 1;
            const cw = barRight(scale, c.endBar) - 1 - cx0;
            const chord = parseChord(c.symbol);
            return (['r', '3', '5'] as const)
              .map((t) => `M${cx0.toFixed(1)},${noteY(tonePitch(t, chord, CHORD_OCTAVE)).toFixed(1)}h${Math.max(cw, 1).toFixed(1)}v${Math.max(rowH - 0.6, 1.6).toFixed(1)}h-${Math.max(cw, 1).toFixed(1)}z`)
              .join('');
          })
          .join('');
        return (
          <g key={si} className="block-g" data-mode={seg.mode} data-start={seg.startBar} data-end={seg.endBar}>
            <title>{root ? `${cells[0].symbol} held · bars ${seg.startBar}–${seg.endBar}` : `${summary} · bars ${seg.startBar}–${seg.endBar}`}</title>
            <rect x={x0} y={y} width={w} height={h} rx={8} fill={root ? '#3A3790' : '#5648D6'} opacity={root ? 0.5 : 0.42} stroke={root ? 'rgba(184,181,224,0.2)' : 'none'} />
            <path d={d} fill="#D9CCFF" opacity={0.95} />
            {!root && cells.slice(1).map((c) => (
              <line key={c.startBar} x1={barLeft(scale, c.startBar)} x2={barLeft(scale, c.startBar)} y1={y + 3} y2={y + h - 3} stroke="#14164A" strokeOpacity={0.35} shapeRendering="crispEdges" />
            ))}
            {root && fits(cells[0].symbol, w) && <text className="chord-text" x={x0 + 6} y={y + 12}>{cells[0].symbol}</text>}
            {!root && cellsFit && cells.map((c) => (
              <text key={c.startBar} className="chord-text" x={barLeft(scale, c.startBar) + 5} y={y + 12}>{c.symbol}</text>
            ))}
            {!root && !cellsFit && fits(summary, w) && <text className="chord-text" x={x0 + 6} y={y + 12}>{summary}</text>}
          </g>
        );
      })}
    </g>
  );
}
