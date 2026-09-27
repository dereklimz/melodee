import { barLeft, barRight, chordCells, type Scale } from '../lib/geometry';
import { CHORD_OCTAVE, HEAD_H } from '../lib/layout';
import { parseChord, tonePitch } from '../lib/chords';
import { DAW, lighten } from '../lib/theme';
import type { Harmony } from '../types/track';

interface Props { harmony: Harmony; pitchRange: { min: number; max: number }; scale: Scale; y: number; h: number }

const fits = (text: string, w: number) => w >= text.length * 6.6 + 8;

/**
 * Chords as clips: one clip per harmony segment with the chord symbols in its name strip and
 * each chord drawn as its three notes, held for as long as the chord lasts. Held roots read
 * as flat bars, progressions as notes stepping up and down.
 */
export function ChordsRow({ harmony, pitchRange, scale, y, h }: Props) {
  const per = harmony.barsPerChord ?? 2;
  const summary = harmony.progression.join(' · ');
  const top = y + HEAD_H + 2;
  const areaH = h - HEAD_H - 4;
  const rows = pitchRange.max - pitchRange.min + 1;
  const rowH = Math.min(5, areaH / rows);
  const offset = (areaH - rowH * rows) / 2;
  const noteY = (pitch: number) => top + offset + (pitchRange.max - pitch) * rowH;

  // Where a chord tone moves to a different pitch in the next chord, join the two notes.
  const allCells = harmony.segments.flatMap((seg) => chordCells(seg, harmony.progression, per));
  let steps = '';
  for (let i = 1; i < allCells.length; i++) {
    const a = parseChord(allCells[i - 1].symbol);
    const b = parseChord(allCells[i].symbol);
    const xa = barRight(scale, allCells[i - 1].endBar) - 1;
    const xb = barLeft(scale, allCells[i].startBar) + 1;
    for (const t of ['r', '3', '5'] as const) {
      const pa = tonePitch(t, a, CHORD_OCTAVE);
      const pb = tonePitch(t, b, CHORD_OCTAVE);
      if (pa !== pb) steps += `M${xa.toFixed(1)},${(noteY(pa) + 1.4).toFixed(1)}L${xb.toFixed(1)},${(noteY(pb) + 1.4).toFixed(1)}`;
    }
  }

  return (
    <g className="mark dim-harmony">
      {harmony.segments.map((seg, si) => {
        const cells = chordCells(seg, harmony.progression, per);
        const x0 = barLeft(scale, seg.startBar);
        const x1 = barRight(scale, seg.endBar);
        const w = x1 - x0;
        const root = seg.mode === 'root';
        const color = root ? DAW.chordRoot : DAW.chordProg;
        const cellsFit = !root && cells.every((c) => fits(c.symbol, (c.endBar - c.startBar + 1) * scale.ppb - 2));
        const d = cells
          .map((c) => {
            const cx0 = barLeft(scale, c.startBar) + 1;
            const cw = Math.max(barRight(scale, c.endBar) - 1 - cx0, 1);
            const chord = parseChord(c.symbol);
            return (['r', '3', '5'] as const)
              .map((t) => `M${cx0.toFixed(1)},${noteY(tonePitch(t, chord, CHORD_OCTAVE)).toFixed(1)}h${cw.toFixed(1)}v${Math.max(rowH - 0.6, 2).toFixed(1)}h-${cw.toFixed(1)}z`)
              .join('');
          })
          .join('');
        return (
          <g key={si} className="block-g" data-mode={seg.mode} data-start={seg.startBar} data-end={seg.endBar}>
            <title>{root ? `${cells[0].symbol} held · bars ${seg.startBar}–${seg.endBar}` : `${summary} · bars ${seg.startBar}–${seg.endBar}`}</title>
            <rect x={x0} y={y} width={w} height={h} rx={2} fill={color} stroke={DAW.line} />
            <rect x={x0} y={y} width={w} height={HEAD_H} rx={2} fill={lighten(color, 0.25)} />
            <path d={d} fill={DAW.note} opacity={0.85} />
            {!root && cells.slice(1).map((c) => (
              <line key={c.startBar} x1={barLeft(scale, c.startBar)} x2={barLeft(scale, c.startBar)} y1={y} y2={y + h} stroke={DAW.line} strokeOpacity={0.55} shapeRendering="crispEdges" />
            ))}
            {root && fits(cells[0].symbol, w) && <text className="clip-name" x={x0 + 5} y={y + 9}>{cells[0].symbol}</text>}
            {!root && cellsFit && cells.map((c) => <text key={c.startBar} className="clip-name" x={barLeft(scale, c.startBar) + 5} y={y + 9}>{c.symbol}</text>)}
            {!root && !cellsFit && fits(summary, w) && <text className="clip-name" x={x0 + 5} y={y + 9}>{summary}</text>}
          </g>
        );
      })}
      <path d={steps} stroke={DAW.note} strokeWidth={1.1} strokeOpacity={0.8} fill="none" />
    </g>
  );
}
