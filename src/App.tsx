import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Timeline } from './components/Timeline';
import { TrackHero } from './components/TrackHero';
import { loadTracks } from './lib/loadTracks';
import type { Track } from './types/track';

const idFromHash = () => window.location.hash.replace('#', '') || null;

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(idFromHash);

  useEffect(() => {
    loadTracks().then(setTracks).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    const onHash = () => setSelectedId(idFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const current = tracks.find((t) => t.track.id === selectedId) ?? tracks[0];

  const select = (id: string) => {
    window.location.hash = id;
    setSelectedId(id);
  };

  return (
    <div className="app">
      <Sidebar tracks={tracks} selectedId={current?.track.id ?? null} onSelect={select} />
      <main className="main">
        {error && (
          <div className="state">
            <strong>Could not load the demo tracks</strong>
            <pre style={{ whiteSpace: 'pre-wrap', textAlign: 'left' }}>{error}</pre>
          </div>
        )}
        {!error && !current && <div className="state">Loading…</div>}
        {current && (
          <>
            <TrackHero track={current.track} />
            <section className="timeline-card" aria-label="Teardown timeline">
              <Timeline key={current.track.id} data={current} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
