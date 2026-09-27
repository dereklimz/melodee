import { useEffect, useRef, useState } from 'react';
import { barLeft, barRight, type Scale } from '../lib/geometry';
import { FAMILY_LABEL, FAMILY_ORDER } from '../lib/theme';
import type { ElementFamily, Track } from '../types/track';
import { ChordsRow } from './ChordsRow';
import { Defs } from './Defs';
import { ElementLane } from './ElementLane';
import { EnergyRow } from './EnergyRow';
import { Ruler } from './Ruler';
import { SectionsRow } from './SectionsRow';

const GUTTER = 118;
const PAD_R = 8;
const GAP = 8;
const H = { ruler: 30, sections: 34, energy: 84, chords: 32, lane: 48 };
const MIN_PPB = 5;

interface Row { key: string; label: string; sub?: string; y: number; h: number; family?: ElementFamily; band: boolean }

export function Timeline({ data }: { data: Track }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const { totalBars } = data.track;
  const ppb = Math.max(MIN_PPB, (width - GUTTER - PAD_R) / totalBars);
  const scale: Scale = { x0: GUTTER, ppb };
  const svgW = GUTTER + totalBars * ppb + PAD_R;

  const lanes = FAMILY_ORDER.filter((f) => data.elements.some((e) => e.family === f) || (f === 'fx' && data.fxEvents.length > 0));

  let cursor = 0;
  const place = (h: number) => {
    const y = cursor;
    cursor += h + GAP;
    return y;
  };
  const ruler = { y: place(H.ruler), h: H.ruler };
  const sections = { y: place(H.sections), h: H.sections };
  const energy = { y: place(H.energy), h: H.energy };
  const chords = { y: place(H.chords), h: H.chords };
  const laneRows = lanes.map((family) => ({ family, y: place(H.lane), h: H.lane }));
  const svgH = cursor - GAP + 4;
  const bodyTop = sections.y;

  const rows: Row[] = [
    { key: 'sections', label: 'Sections', y: sections.y, h: sections.h, band: false },
    { key: 'energy', label: 'Energy', sub: 'high → low', y: energy.y, h: energy.h, band: true },
    { key: 'chords', label: 'Chords', sub: 'root / progression', y: chords.y, h: chords.h, band: true },
    ...laneRows.map((l) => ({ key: l.family, label: FAMILY_LABEL[l.family], y: l.y, h: l.h, family: l.family, band: true })),
  ];

  const x0 = barLeft(scale, 1);
  const x1 = barRight(scale, totalBars);
  const eightBar: number[] = [];
  for (let b = 9; b <= totalBars; b += 8) eightBar.push(b);

  return (
    <div ref={wrapRef} className="timeline-scroll">
      <svg className="timeline-svg" width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} role="img" aria-label={`Teardown of ${data.track.title}: sections, energy, chords and ${lanes.length} element lanes across ${totalBars} bars`}>
        <Defs />

        {rows.filter((r) => r.band).map((r) => (
          <rect key={`bg-${r.key}`} x={x0} y={r.y - 2} width={x1 - x0} height={r.h + 4} rx={12} fill="#1C1F5A" opacity={0.55} />
        ))}

        <g stroke="#B8B5E0" strokeOpacity={0.07} shapeRendering="crispEdges">
          {eightBar.map((b) => (
            <line key={b} x1={barLeft(scale, b)} x2={barLeft(scale, b)} y1={bodyTop} y2={svgH - 2} />
          ))}
        </g>

        <Ruler totalBars={totalBars} scale={scale} y={ruler.y} h={ruler.h} />
        <SectionsRow sections={data.sections} scale={scale} y={sections.y} h={sections.h} />
        <EnergyRow energy={data.energy} totalBars={totalBars} scale={scale} y={energy.y} h={energy.h} />
        <ChordsRow harmony={data.harmony} scale={scale} y={chords.y} h={chords.h} />
        {laneRows.map((l) => (
          <ElementLane
            key={l.family}
            family={l.family}
            element={data.elements.find((e) => e.family === l.family)}
            events={l.family === 'fx' ? data.fxEvents : []}
            scale={scale}
            y={l.y}
            h={l.h}
          />
        ))}

        {/* Section boundaries read straight down through every row. */}
        <g className="mark dim-time" stroke="#B8B5E0" strokeOpacity={0.3} shapeRendering="crispEdges" pointerEvents="none">
          {data.sections.slice(1).map((s) => (
            <line key={s.startBar} x1={barLeft(scale, s.startBar)} x2={barLeft(scale, s.startBar)} y1={bodyTop} y2={svgH - 2} />
          ))}
        </g>

        {rows.map((r) => (
          <g key={`label-${r.key}`}>
            {r.family && <circle cx={10} cy={r.y + r.h / 2} r={5} fill={`url(#g-${r.family})`} />}
            <text className="lane-label" x={r.family ? 24 : 6} y={r.y + r.h / 2 + (r.sub ? -1 : 4)}>
              {r.label}
            </text>
            {r.sub && (
              <text className="lane-sub" x={6} y={r.y + r.h / 2 + 12}>
                {r.sub}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
