import { useRef } from 'react';
import { FAMILY_FLAT } from '../lib/theme';
import type { Track } from '../types/track';

interface Props {
  data: Track;
  width: number;
  scrollLeft: number;
  contentW: number;
  viewW: number;
  onScrollTo: (left: number) => void;
}

const ROW_H = 3;

/** Whole-song minimap above the ruler: every clip as a thin bar, and a window showing what is on screen. */
export function Overview({ data, width, scrollLeft, contentW, viewW, onScrollTo }: Props) {
  const dragging = useRef(false);
  const { totalBars } = data.track;
  const rows = data.elements;
  const h = rows.length * (ROW_H + 1) + 6;
  const px = width / totalBars;
  const winW = Math.min(width, (viewW / contentW) * width);
  const winX = (scrollLeft / contentW) * width;

  const seek = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const center = ((clientX - r.left) / r.width) * contentW;
    onScrollTo(center - viewW / 2);
  };

  return (
    <svg
      className="overview"
      width={width}
      height={h}
      role="presentation"
      onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); seek(e.clientX, e.currentTarget); }}
      onPointerMove={(e) => dragging.current && seek(e.clientX, e.currentTarget)}
      onPointerUp={() => { dragging.current = false; }}
    >
      {rows.map((el, i) => el.blocks.map((b, j) => (
        <rect key={`${i}-${j}`} x={(b.startBar - 1) * px} y={3 + i * (ROW_H + 1)} width={(b.endBar - b.startBar + 1) * px} height={ROW_H} fill={FAMILY_FLAT[el.family]} opacity={b.confidence < 0.6 ? 0.45 : 0.95} />
      )))}
      {data.sections.slice(1).map((s) => <line key={s.startBar} x1={(s.startBar - 1) * px} x2={(s.startBar - 1) * px} y1={0} y2={h} stroke="#fff" strokeOpacity={0.25} shapeRendering="crispEdges" />)}
      <rect x={winX} y={0.5} width={Math.max(winW, 4)} height={h - 1} fill="#fff" fillOpacity={0.12} stroke="#fff" strokeOpacity={0.75} />
    </svg>
  );
}
