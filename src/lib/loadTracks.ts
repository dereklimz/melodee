import { parseTrack } from './validate';
import type { Track } from '../types/track';

/** Loads every track listed in /tracks/index.json. Swap or add a JSON file and it appears with no code change. */
export async function loadTracks(): Promise<Track[]> {
  const idsRes = await fetch('/tracks/index.json');
  if (!idsRes.ok) throw new Error('Could not load /tracks/index.json');
  const ids = (await idsRes.json()) as string[];
  return Promise.all(
    ids.map(async (id) => {
      const res = await fetch(`/tracks/${id}.json`);
      if (!res.ok) throw new Error(`Could not load /tracks/${id}.json`);
      return parseTrack(await res.json());
    }),
  );
}
