import { trackLength } from '../lib/time';
import type { TrackInfo } from '../types/track';

export function TrackHero({ track }: { track: TrackInfo }) {
  return (
    <header className="hero">
      <div>
        <div className="hero-eyebrow">Track teardown</div>
        <h1 className="hero-title">{track.title}</h1>
        <div className="hero-artist">{track.artist}</div>
      </div>
      <div className="chips">
        <span className="chip">{track.bpm} BPM · 4/4</span>
        <span className="chip">{track.key}</span>
        <span className="chip">{track.totalBars} bars</span>
        <span className="chip">{trackLength(track)}</span>
      </div>
    </header>
  );
}
