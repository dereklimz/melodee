import { barLeft, type Scale } from '../lib/geometry';

interface Props { totalBars: number; scale: Scale; y: number; h: number }

/** Bar ruler: a tick every bar, a taller tick and number every 8 bars (1, 9, 17…). */
export function Ruler({ totalBars, scale, y, h }: Props) {
  const ticks = [];
  for (let bar = 1; bar <= totalBars; bar++) {
    const major = (bar - 1) % 8 === 0;
    const mid = (bar - 1) % 4 === 0;
    const x = barLeft(scale, bar);
    ticks.push(
      <g key={bar}>
        <line x1={x} x2={x} y1={y + h} y2={y + h - (major ? 9 : mid ? 6 : 3)} stroke="#fff" strokeOpacity={major ? 0.9 : 0.4} shapeRendering="crispEdges" />
        {major && (
          <text className="ruler-num" x={x + 3} y={y + h - 12}>
            {bar}
          </text>
        )}
      </g>,
    );
  }
  return <g className="mark dim-time">{ticks}</g>;
}
