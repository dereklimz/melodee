import { barLeft, barRight, energyPoints, toPath, type Scale } from '../lib/geometry';
import type { EnergySegment } from '../types/track';

interface Props { energy: EnergySegment[]; totalBars: number; scale: Scale; y: number; h: number }

export function EnergyRow({ energy, totalBars, scale, y, h }: Props) {
  const yTop = y + 12;
  const yBottom = y + h - 10;
  const pts = energyPoints(energy, scale, yTop, yBottom);
  const line = toPath(pts);
  const area = `${line} L${barRight(scale, totalBars).toFixed(1)},${yBottom} L${barLeft(scale, 1).toFixed(1)},${yBottom} Z`;
  const x0 = barLeft(scale, 1);
  const x1 = barRight(scale, totalBars);
  return (
    <g className="mark dim-volume">
      {[0.5].map((lvl) => {
        const gy = yBottom - lvl * (yBottom - yTop);
        return <line key={lvl} x1={x0} x2={x1} y1={gy} y2={gy} stroke="#B8B5E0" strokeOpacity={0.1} strokeDasharray="2 4" shapeRendering="crispEdges" />;
      })}
      <path d={area} fill="#F0509A" opacity={0.22} />
      <path d={line} fill="none" stroke="#FF7EC3" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </g>
  );
}
