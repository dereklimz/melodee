import { barLeft, barRight, chordCells, type Scale } from '../lib/geometry';
import type { Harmony } from '../types/track';

interface Props { harmony: Harmony; scale: Scale; y: number; h: number }

const CHAR_W = 7;
const fits = (text: string, w: number) => w >= text.length * CHAR_W + 10;

/**
 * One chip per harmony segment. A root segment holds a single chord; a
 * progression segment is divided at each chord change. Symbols are drawn in
 * the cells when they fit, otherwise the progression is written once at the
 * start of the segment.
 */
export function ChordsRow({ harmony, scale, y, h }: Props) {
  const per = harmony.barsPerChord ?? 2;
  const summary = harmony.progression.join(' · ');
  return (
    <g className="mark dim-harmony">
      {harmony.segments.map((seg, si) => {
        const cells = chordCells(seg, harmony.progression, per);
        const x0 = barLeft(scale, seg.startBar) + 1;
        const x1 = barRight(scale, seg.endBar) - 1;
        const w = x1 - x0;
        const root = seg.mode === 'root';
        const cellsFit = !root && cells.every((c) => fits(c.symbol, (c.endBar - c.startBar + 1) * scale.ppb - 2));
        return (
          <g key={si} className="block-g" data-mode={seg.mode} data-start={seg.startBar} data-end={seg.endBar}>
            <title>{root ? `${cells[0].symbol} held · bars ${seg.startBar}–${seg.endBar}` : `${summary} · bars ${seg.startBar}–${seg.endBar}`}</title>
            <rect x={x0} y={y} width={w} height={h} rx={8} fill={root ? '#3A3790' : 'url(#g-chords)'} stroke={root ? 'rgba(184,181,224,0.35)' : 'none'} />
            {!root &&
              cells.slice(1).map((c) => (
                <line key={c.startBar} x1={barLeft(scale, c.startBar)} x2={barLeft(scale, c.startBar)} y1={y + 6} y2={y + h - 6} stroke="#14164A" strokeOpacity={0.4} shapeRendering="crispEdges" />
              ))}
            {root && fits(cells[0].symbol, w) && (
              <text className="chord-text" x={x0 + w / 2} y={y + h / 2 + 4} textAnchor="middle">{cells[0].symbol}</text>
            )}
            {!root && cellsFit &&
              cells.map((c) => (
                <text key={c.startBar} className="chord-text" x={(barLeft(scale, c.startBar) + barRight(scale, c.endBar)) / 2} y={y + h / 2 + 4} textAnchor="middle">{c.symbol}</text>
              ))}
            {!root && !cellsFit && fits(summary, w) && (
              <text className="chord-text" x={x0 + 10} y={y + h / 2 + 4}>{summary}</text>
            )}
          </g>
        );
      })}
    </g>
  );
}
