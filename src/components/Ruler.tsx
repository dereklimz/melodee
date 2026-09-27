import { barLeft, type Scale } from '../lib/geometry';
import { barToSeconds, formatTime } from '../lib/time';
import type { TrackInfo } from '../types/track';

interface Props { track: TrackInfo; scale: Scale; y: number; h: number }

const SPACINGS = [1, 2, 4, 8, 16];

/**
 * Tempo ruler in the arrangement-view style: bar numbers with the clock time beneath,
 * a tick per bar, and once zoomed in far enough the beats too, labelled bar.beat (1.2, 1.3…).
 */
export function Ruler({ track, scale, y, h }: Props) {
  const every = SPACINGS.find((e) => e * scale.ppb >= 46) ?? 16;
  const beatW = scale.ppb / 4;
  const beatTicks = beatW >= 6;
  const beatLabels = beatW >= 26;
  const els = [];
  for (let bar = 1; bar <= track.totalBars; bar++) {
    const labelled = (bar - 1) % every === 0;
    const mid = (bar - 1) % 4 === 0;
    const x = barLeft(scale, bar);
    els.push(
      <g key={bar}>
        <line x1={x} x2={x} y1={y + h} y2={y + h - (labelled ? 9 : mid ? 6 : 4)} stroke="#fff" strokeOpacity={labelled ? 0.7 : mid ? 0.35 : 0.2} shapeRendering="crispEdges" />
        {beatTicks &&
          [1, 2, 3].map((b) => (
            <g key={b}>
              <line x1={x + b * beatW} x2={x + b * beatW} y1={y + h} y2={y + h - 4} stroke="#fff" strokeOpacity={0.22} shapeRendering="crispEdges" />
              {beatLabels && <text className="ruler-beat" x={x + b * beatW + 3} y={y + 13}>{`${bar}.${b + 1}`}</text>}
            </g>
          ))}
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
