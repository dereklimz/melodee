import { useEffect, useMemo, useRef, useState } from 'react';
import { barLeft, barRight, type Scale } from '../lib/geometry';
import { chordPitchRange, laneMetrics, type LaneMetrics } from '../lib/layout';
import { midiName } from '../lib/chords';
import { DAW, FAMILY_FLAT, FAMILY_LABEL, FAMILY_ORDER } from '../lib/theme';
import type { ElementFamily, Track } from '../types/track';
import { ChordsRow } from './ChordsRow';
import { ElementLane } from './ElementLane';
import { EnergyRow } from './EnergyRow';
import { Overview } from './Overview';
import { Ruler } from './Ruler';
import { SectionsRow } from './SectionsRow';

const LABEL_W = 156;
const PAD_L = 0;
const PAD_R = 0;
const GAP = 2;
const H = { ruler: 40, sections: 26, energy: 64, chords: 64 };
const ZOOMS = [1, 1.5, 2, 3, 4, 6, 8, 12, 16];

interface Row { key: string; label: string; sub?: string; y: number; h: number; family?: ElementFamily; band: boolean; metrics?: LaneMetrics; tile: string; dark: boolean }

export function Timeline({ data }: { data: Track }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [scrollLeft, setScrollLeft] = useState(0);
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
  const place = (h: number, gap = GAP) => {
    const y = cursor;
    cursor += h + gap;
    return y;
  };
  const ruler = { y: place(H.ruler, 4), h: H.ruler };
  const sections = { y: place(H.sections, 6), h: H.sections };
  const energy = { y: place(H.energy), h: H.energy };
  const chords = { y: place(H.chords), h: H.chords };
  const laneRows = lanes.map((m) => ({ m, y: place(m.h) }));
  const svgH = cursor - GAP;

  const rows: Row[] = [
    { key: 'tempo', label: 'Tempo', sub: `${bpm} BPM · 4/4`, y: ruler.y, h: ruler.h, band: false, tile: DAW.tile, dark: false },
    { key: 'sections', label: 'Sections', y: sections.y, h: sections.h, band: false, tile: DAW.tile, dark: false },
    { key: 'energy', label: 'Energy', sub: 'high → low', y: energy.y, h: energy.h, band: true, tile: DAW.tile, dark: false },
    { key: 'chords', label: 'Chords', sub: `${midiName(chordRange.min)}–${midiName(chordRange.max)}`, y: chords.y, h: chords.h, band: true, tile: DAW.chordProg, dark: true },
    ...laneRows.map(({ m, y }) => ({ key: m.family, label: FAMILY_LABEL[m.family], y, h: m.h, family: m.family, band: true, metrics: m, tile: FAMILY_FLAT[m.family], dark: true })),
  ];

  // Bar grid: a line every `step` bars, stronger every 4 steps, laid under and over the clips.
  const step = [1, 2, 4, 8].find((s) => s * ppb >= 14) ?? 8;
  const gridUnder: string[] = [];
  const gridOver: string[] = [];
  for (let b = 1 + step; b <= totalBars; b += step) {
    const strong = (b - 1) % (step * 4) === 0;
    (strong ? gridOver : gridUnder).push(`M${barLeft(scale, b).toFixed(1)},${energy.y}V${svgH}`);
  }
  const strongBars = gridOver.join('');
  const weakBars = gridUnder.join('');

  const scrollTo = (left: number) => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = Math.max(0, Math.min(left, contentW - el.clientWidth));
  };

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

      <div className="timeline-grid" style={{ gridTemplateColumns: `minmax(0, 1fr) ${LABEL_W}px` }}>
        <div className="timeline-main">
          <Overview data={data} width={width} scrollLeft={scrollLeft} contentW={contentW} viewW={width} onScrollTo={scrollTo} />
          <div ref={scrollRef} className="timeline-scroll" onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}>
            <svg className="timeline-svg" width={contentW} height={svgH} viewBox={`0 0 ${contentW} ${svgH}`} role="img" aria-label={`Teardown of ${data.track.title}: tempo, sections, energy, chords with notes, and ${lanes.length} element lanes across ${totalBars} bars`}>
              {rows.filter((r) => r.band).map((r) => (
                <rect key={`bg-${r.key}`} x={0} y={r.y} width={contentW} height={r.h} fill={DAW.lane} />
              ))}
              <path d={weakBars} stroke="#fff" strokeOpacity={0.05} shapeRendering="crispEdges" pointerEvents="none" fill="none" />

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

              <path d={strongBars} stroke="#000" strokeOpacity={0.22} shapeRendering="crispEdges" pointerEvents="none" fill="none" />
              {/* Section boundaries read straight down through every row. */}
              <g className="mark dim-time" stroke="#fff" strokeOpacity={0.4} shapeRendering="crispEdges" pointerEvents="none">
                {data.sections.slice(1).map((s) => (
                  <line key={s.startBar} x1={barLeft(scale, s.startBar)} x2={barLeft(scale, s.startBar)} y1={sections.y} y2={svgH} />
                ))}
              </g>
              <line x1={barRight(scale, totalBars)} x2={barRight(scale, totalBars)} y1={sections.y} y2={svgH} stroke="#fff" strokeOpacity={0.4} shapeRendering="crispEdges" />
            </svg>
          </div>
        </div>

        {/* Track headers sit on the right, like the arrangement view, and stay put while the timeline scrolls. */}
        <svg className="timeline-svg tile-col" width={LABEL_W} height={svgH} aria-hidden="true" style={{ marginTop: data.elements.length * 4 + 6 + 6 }}>
          {rows.map((r) => {
            const fg = r.dark ? DAW.note : '#fff';
            const sub = r.dark ? 'rgba(20,22,74,0.72)' : 'rgba(255,255,255,0.7)';
            return (
              <g key={`tile-${r.key}`}>
                <rect x={0} y={r.y} width={LABEL_W} height={r.h} fill={r.tile} />
                <text className="tile-name" x={8} y={r.y + 16} fill={fg}>{r.label}</text>
                {r.sub && <text className="tile-sub" x={8} y={r.y + 29} fill={sub}>{r.sub}</text>}
                {r.metrics?.kind === 'hits' && r.metrics.voices.length > 1 &&
                  r.metrics.voices.map((v, i) => (
                    <text key={v} className="tile-voice" x={LABEL_W - 8} textAnchor="end" y={r.y + 14 + (i + 0.5) * (r.metrics!.notesH / r.metrics!.voices.length) + 3} fill={sub}>{v}</text>
                  ))}
                {r.metrics?.kind === 'notes' && (
                  <>
                    <text className="tile-voice" x={LABEL_W - 8} textAnchor="end" y={r.y + 25} fill={sub}>{midiName(r.metrics.pitchMax)}</text>
                    <text className="tile-voice" x={LABEL_W - 8} textAnchor="end" y={r.y + 14 + r.metrics.notesH} fill={sub}>{midiName(r.metrics.pitchMin)}</text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
