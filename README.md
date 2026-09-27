# Melodee — Track Teardown (UI demo)

A clickable demo that turns a reference track into the arrangement "whiteboard" teardown: sections, energy,
chords, and one lane per element, with filter sweeps, volume and spatial movement drawn inside each lane.
All analysis is hand-authored mock JSON; there is no audio analysis and no backend.

## Run

```bash
npm install --legacy-peer-deps
npm run dev      # http://localhost:5173, add #demo-02 / #demo-03 to open another track
npx vitest run   # geometry, validator, and every mock track checked against the data model
```

## Data

Each track is one JSON file in `public/tracks/`, listed in `public/tracks/index.json`. Positions are bars,
1-indexed, `endBar` inclusive. Swap a file or add an id to the index and the view changes with no code change.
Types live in `src/types/track.ts`; `src/lib/validate.ts` rejects malformed files with the path of the bad field.
`harmony.barsPerChord` is an optional addition to the spec's data model (default 2).

## Status

Phase 1 of 3: mock data and the timeline renderer. Library click-to-load is in as a review aid.
Next: Phase 2 (drag and drop, analyzing state, fake-door modal), Phase 3 (playback, tooltips, dimension filter, zoom).
Design reference: `design/reference.png`.

The previous demo (real Demucs / DrumSep / Basic Pitch pipeline) is saved at the `v1-real-pipeline` tag.
