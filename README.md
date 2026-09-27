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
Additions to the spec's data model, all optional:
- `harmony.barsPerChord` (default 2).
- `elements[].patterns`: reusable drum-hit patterns (`voices` mapped to 16th-note steps) and note patterns written as
  chord tones (`r 3 5 7 8`). `blocks[].pattern` picks one and `blocks[].overrides` swaps it for a bar range (fills, rolls).
  Notes are resolved against the chord playing at each bar, so bass, synths, vocals and the chord row all follow the progression.
  A block with no pattern falls back to a plain presence bar.

## Status

Phase 1 of 3: mock data and the timeline renderer. Library click-to-load and timeline zoom are in as review aids.
Next: Phase 2 (drag and drop, analyzing state, fake-door modal), Phase 3 (playback, tooltips, dimension filter, zoom).
Design reference: `design/reference.png`.

The previous demo (real Demucs / DrumSep / Basic Pitch pipeline) is saved at the `v1-real-pipeline` tag.
