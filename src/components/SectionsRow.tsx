import { barLeft, barRight, type Scale } from '../lib/geometry';
import { DAW, SECTION_FLAT, SECTION_STYLE } from '../lib/theme';
import type { Section } from '../types/track';

interface Props { sections: Section[]; scale: Scale; y: number; h: number }

const textFits = (label: string, w: number) => w >= label.length * 7 + 16;

export function SectionsRow({ sections, scale, y, h }: Props) {
  return (
    <g className="mark dim-time">
      {sections.map((s, i) => {
        const x0 = barLeft(scale, s.startBar);
        const x1 = barRight(scale, s.endBar);
        const w = x1 - x0;
        return (
          <g key={i} className="block-g" data-section={s.label} data-start={s.startBar} data-end={s.endBar}>
            <rect x={x0} y={y} width={w} height={h} rx={2} fill={SECTION_FLAT[s.type]} stroke={DAW.line} />
            {textFits(s.label, w) && (
              <text className="section-text" x={x0 + 8} y={y + h / 2 + 4} fill={SECTION_STYLE[s.type].text}>{s.label}</text>
            )}
          </g>
        );
      })}
    </g>
  );
}
