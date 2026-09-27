import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/app';
import { audioEngine } from '../audio/engine';
import { sectionTypeColors, colors } from '../styles/tokens';
import { seekToBar } from '../utils/seek';
import './Structure.css';

// Below this pixel width, drop the energy chip (label alone still fits/ellipsizes).
const HIDE_CHIP_BELOW_PX = 100;
// Below this, drop the label too — a lone truncated letter reads worse than
// no label at all, so require enough room for a short recognizable word.
const HIDE_LABEL_BELOW_PX = 56;

export function Structure() {
  const analysis = useAppStore((state) => state.analysis);
  const loopRange = useAppStore((state) => state.loopRange);
  const setLoopRange = useAppStore((state) => state.setLoopRange);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  if (!analysis) return null;

  const barsToPercent = (bar: number) => (bar / analysis.song.bars) * 100;

  return (
    <div className="structure-row" ref={containerRef}>
      {analysis.sections.map((section) => {
        const startPercent = barsToPercent(section.startBar);
        const endPercent = barsToPercent(section.endBar);
        const widthPercent = endPercent - startPercent;
        const widthPx = (widthPercent / 100) * containerWidth;
        const bgColor = sectionTypeColors[section.type] || colors.sectionIntroOutro;

        const showChip = widthPx >= HIDE_CHIP_BELOW_PX;
        const showLabel = widthPx >= HIDE_LABEL_BELOW_PX;
        const isLooped = loopRange?.startBar === section.startBar && loopRange?.endBar === section.endBar;

        const handleSeek = () => seekToBar(section.startBar);
        const handleLoopClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (isLooped) {
            setLoopRange(null);
            audioEngine.setLoop(null);
          } else {
            const range = { startBar: section.startBar, endBar: section.endBar };
            setLoopRange(range);
            audioEngine.setLoop(range);
          }
        };

        return (
          <div
            key={section.id}
            className={`section-block ${isLooped ? 'looped' : ''}`}
            style={{
              left: `${startPercent}%`,
              width: `${widthPercent}%`,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ['--section-color' as any]: bgColor,
            }}
            title={`${section.label} · ${section.energyLevel} energy (bars ${section.startBar + 1}–${section.endBar})`}
            onClick={handleSeek}
          >
            {showLabel && (
              <button
                className={`loop-btn ${isLooped ? 'active' : ''}`}
                title={isLooped ? `Stop looping ${section.label}` : `Loop ${section.label}`}
                onClick={handleLoopClick}
              >
                ⟲
              </button>
            )}
            {showLabel && <span className="section-label">{section.label}</span>}
            {showChip && <span className={`energy-chip level-${section.energyLevel}`}>{section.energyLevel}</span>}
          </div>
        );
      })}
    </div>
  );
}
