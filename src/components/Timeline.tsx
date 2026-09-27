import { useEffect, useMemo, useRef, useState } from 'react';
import { barLeft, barRight, type Scale } from '../lib/geometry';
import { chordPitchRange, laneMetrics, type LaneMetrics } from '../lib/layout';
import { midiName } from '../lib/chords';
import { FAMILY_LABEL, FAMILY_ORDER } from '../lib/theme';
import type { ElementFamily, Track } from '../types/track';
import { ChordsRow } from './ChordsRow';
import { Defs } from './Defs';
import { ElementLane } from './ElementLane';
import { EnergyRow } from './EnergyRow';
import { Ruler } from './Ruler';
import { SectionsRow } from './SectionsRow';

const LABEL_W = 150;
const PAD_L = 6;
const PAD_R = 14;
const GAP = 8;
const H = { ruler: 40, sections: 28, energy: 64, chords: 62 };
const ZOOMS = [1, 1.5, 2, 3, 4, 6, 8];

interface Row { key: string; label: string; sub?: string; y: number; h: number; family?: ElementFamily; band: boolean; metrics?: LaneMetrics }

export function Timeline({ data }: { data: Track }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [zoomIdx, setZoomIdx] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const { totalBars, bpm } = data.track;
  const zoom = ZOOMS[zoomIdx];
  const fit = Math.max(2, (width - PAD_L - PAD_R) / totalBars);
  const ppb = fit * zoom;
  const scale: Scale = { x0: PAD_L, ppb };
  const contentW = PAD_L + totalBars * ppb + PAD_R;

  const lanes = useMemo(
    () => FAMILY_ORDER.filter((f) => data.elements.some((e) => e.family === f) || (f === 'fx' && data.fxEvents.length > 0)).map((f) => laneMetrics(data, f)),
    [data],
  );
  const chordRange = useMemo(() => chordPitchRange(data), [data]);

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
  const laneRows = lanes.map((m) => ({ m, y: place(m.h) }));
  const svgH = cursor - GAP + 4;

  const rows: Row[] = [
    { key: 'tempo', label: 'Tempo', sub: `${bpm} BPM · 4/4`, y: ruler.y, h: ruler.h, band: false },
    { key: 'sections', label: 'Sections', y: sections.y, h: sections.h, band: false },
    { key: 'energy', label: 'Energy', sub: 'high → low', y: energy.y, h: energy.h, band: true },
    { key: 'chords', label: 'Chords', sub: `${midiName(chordRange.min)}–${midiName(chordRange.max)}`, y: chords.y, h: chords.h, band: true },
    ...laneRows.map(({ m, y }) => ({ key: m.family, label: FAMILY_LABEL[m.family], y, h: m.h, family: m.family, band: true, metrics: m })),
  ];

  const x0 = barLeft(scale, 1);
  const x1 = barRight(scale, totalBars);
  const barGrid = ppb >= 24;
  const gridBars: number[] = [];
  if (barGrid) for (let b = 2; b <= totalBars; b++) gridBars.push(b);

  return (
    <div>
      <div className="tl-head">
        <span className="tl-title">Teardown</span>
        <div className="zoom" role="group" aria-label="Timeline zoom">
          <button className="zoom-btn" onClick={() => setZoomIdx((i) => Math.max(0, i - 1))} disabled={zoomIdx === 0} aria-label="Zoom out">−</button>
          <span className="zoom-read" aria-live="polite">{zoom}×</span>
          <button className="zoom-btn" onClick={() => setZoomIdx((i) => Math.min(ZOOMS.length - 1, i + 1))} disabled={zoomIdx === ZOOMS.length - 1} aria-label="Zoom in">+</button>
        </div>
      </div>

      <div className="timeline-grid" style={{ gridTemplateColumns: `${LABEL_W}px minmax(0, 1fr)` }}>
        <svg className="timeline-svg" width={LABEL_W} height={svgH} aria-hidden="true">
          <Defs />
          {rows.map((r) => (
            <g key={`label-${r.key}`}>
              {r.family && <circle cx={10} cy={r.y + r.h / 2} r={5} fill={`url(#g-${r.family})`} />}
              <text className="lane-label" x={r.family ? 24 : 6} y={r.y + r.h / 2 + (r.sub ? -1 : 4)}>{r.label}</text>
              {r.sub && <text className="lane-sub" x={r.family ? 24 : 6} y={r.y + r.h / 2 + 12}>{r.sub}</text>}
              {r.metrics?.kind === 'hits' && r.metrics.voices.length > 1 &&
                r.metrics.voices.map((v, i) => (
                  <text key={v} className="voice-label" x={LABEL_W - 6} textAnchor="end" y={r.y + 6 + (i + 0.5) * ((r.metrics!.notesH) / r.metrics!.voices.length) + 3}>{v}</text>
                ))}
              {r.metrics?.kind === 'notes' && (
                <>
                  <text className="voice-label" x={LABEL_W - 6} textAnchor="end" y={r.y + 6 + 8}>{midiName(r.metrics.pitchMax)}</text>
                  <text className="voice-label" x={LABEL_W - 6} textAnchor="end" y={r.y + 6 + r.metrics.notesH - 2}>{midiName(r.metrics.pitchMin)}</text>
                </>
              )}
            </g>
          ))}
        </svg>

        <div ref={scrollRef} className="timeline-scroll">
          <svg className="timeline-svg" width={contentW} height={svgH} viewBox={`0 0 ${contentW} ${svgH}`} role="img" aria-label={`Teardown of ${data.track.title}: tempo, sections, energy, chords with notes, and ${lanes.length} element lanes across ${totalBars} bars`}>
            <Defs />

            {rows.filter((r) => r.band).map((r) => (
              <rect key={`bg-${r.key}`} x={x0} y={r.y - 2} width={x1 - x0} height={r.h + 4} rx={12} fill="#1C1F5A" opacity={0.32} />
            ))}

            {barGrid && (
              <g stroke="#B8B5E0" strokeOpacity={0.06} shapeRendering="crispEdges" pointerEvents="none">
                {gridBars.map((b) => <line key={b} x1={barLeft(scale, b)} x2={barLeft(scale, b)} y1={energy.y} y2={svgH - 2} />)}
              </g>
            )}

            <Ruler track={data.track} scale={scale} y={ruler.y} h={ruler.h} />
            <SectionsRow sections={data.sections} scale={scale} y={sections.y} h={sections.h} />
            <EnergyRow energy={data.energy} totalBars={totalBars} scale={scale} y={energy.y} h={energy.h} />
            <ChordsRow harmony={data.harmony} pitchRange={chordRange} scale={scale} y={chords.y} h={chords.h} />
            {laneRows.map(({ m, y }) => (
              <ElementLane
                key={m.family}
                family={m.family}
                metrics={m}
                harmony={data.harmony}
                totalBars={totalBars}
                element={data.elements.find((e) => e.family === m.family)}
                events={m.family === 'fx' ? data.fxEvents : []}
                scale={scale}
                y={y}
              />
            ))}

            {/* Section boundaries read straight down through every row. */}
            <g className="mark dim-time" stroke="#B8B5E0" strokeOpacity={0.16} shapeRendering="crispEdges" pointerEvents="none">
              {data.sections.slice(1).map((s) => (
                <line key={s.startBar} x1={barLeft(scale, s.startBar)} x2={barLeft(scale, s.startBar)} y1={sections.y} y2={svgH - 2} />
              ))}
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
