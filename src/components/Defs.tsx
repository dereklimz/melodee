import { ELEMENT_FAMILIES, SECTION_TYPES } from '../types/track';
import { FAMILY_GRADIENT, SECTION_STYLE } from '../lib/theme';

/** Gradients and filters shared by every row of the timeline SVG. */
export function Defs() {
  return (
    <defs>
      {ELEMENT_FAMILIES.map((f) => (
        <linearGradient key={f} id={`g-${f}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={FAMILY_GRADIENT[f][0]} />
          <stop offset="1" stopColor={FAMILY_GRADIENT[f][1]} />
        </linearGradient>
      ))}
      {SECTION_TYPES.map((t) => (
        <linearGradient key={t} id={`sg-${t}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={SECTION_STYLE[t].gradient[0]} />
          <stop offset="1" stopColor={SECTION_STYLE[t].gradient[1]} />
        </linearGradient>
      ))}
      <linearGradient id="g-chords" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#7B2FF7" />
        <stop offset="1" stopColor="#6A5AF9" />
      </linearGradient>
      <linearGradient id="energy-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#F0509A" stopOpacity="0.28" />
        <stop offset="1" stopColor="#7B2FF7" stopOpacity="0.02" />
      </linearGradient>
      <filter id="f-blur" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
      <filter id="f-glow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="2.5" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}
