import { barLeft, type Scale } from '../lib/geometry';
import { barToSeconds, formatTime } from '../lib/time';
import type { TrackInfo } from '../types/track';

interface Props { track: TrackInfo; scale: Scale; y: number; h: number }

const SPACINGS = [1, 2, 4, 8, 16];

/**
 * Tempo ruler: bar numbers (1, 9, 17…), the clock time of each labelled bar, a tick per
 * bar, and beat ticks once zoomed in far enough to tell them apart. Labels thin out or
 * fill in with zoom so they never collide.
 */
export function Ruler({ track, scale, y, h }: Props) {
  const every = SPACINGS.find((e) => e * scale.ppb >= 46) ?? 16;
  const beatTicks = scale.ppb / 4 >= 6;
  const els = [];
  for (let bar = 1; bar <= track.totalBars; bar++) {
    const labelled = (bar - 1) % every === 0;
    const mid = (bar - 1) % 4 === 0;
    const x = barLeft(scale, bar);
    els.push(
      <g key={bar}>
        <line x1={x} x2={x} y1={y + h} y2={y + h - (labelled ? 8 : mid ? 5 : 3)} stroke="#fff" strokeOpacity={labelled ? 0.6 : mid ? 0.28 : 0.16} shapeRendering="crispEdges" />
        {beatTicks &&
          [1, 2, 3].map((b) => <line key={b} x1={x + (b * scale.ppb) / 4} x2={x + (b * scale.ppb) / 4} y1={y + h} y2={y + h - 2} stroke="#fff" strokeOpacity={0.14} shapeRendering="crispEdges" />)}
        {labelled && (
          <>
            <text className="ruler-num" x={x + 3} y={y + 13}>{bar}</text>
            <text className="ruler-time" x={x + 3} y={y + 25}>{formatTime(barToSeconds(track, bar))}</text>
          </>
        )}
      </g>,
    );
  }
  return <g className="mark dim-time">{els}</g>;
}
