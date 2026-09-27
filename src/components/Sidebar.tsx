import { ARTWORK } from '../lib/theme';
import { trackLength } from '../lib/time';
import type { Track } from '../types/track';

interface Props { tracks: Track[]; selectedId: string | null; onSelect: (id: string) => void }

export function Sidebar({ tracks, selectedId, onSelect }: Props) {
  return (
    <aside className="sidebar" aria-label="Track library">
      <div className="brand">
        <span className="brand-orb" aria-hidden="true" />
        <span className="brand-name">Melodee</span>
      </div>
      <div className="sidebar-title">Library · {tracks.length} demo tracks</div>
      <ul className="library">
        {tracks.map(({ track }, i) => {
          const [a, b] = ARTWORK[i % ARTWORK.length];
          return (
            <li key={track.id}>
              <button className="lib-row" aria-pressed={track.id === selectedId} onClick={() => onSelect(track.id)}>
                <span className="lib-num">{String(i + 1).padStart(2, '0')}</span>
                <span className="lib-art" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} aria-hidden="true" />
                <span className="lib-text">
                  <span className="lib-title" style={{ display: 'block' }}>{track.title}</span>
                  <span className="lib-artist" style={{ display: 'block' }}>{track.artist}</span>
                  <span className="lib-meta" style={{ display: 'block' }}>{track.bpm} BPM · {track.key}</span>
                  <span className="lib-meta" style={{ display: 'block' }}>{trackLength(track)}</span>
                </span>
                <span className="lib-more" aria-hidden="true">···</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
