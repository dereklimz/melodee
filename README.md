# 🎚️ Melodee

Drop in a track and get a real arrangement teardown: genuine stem separation, per-instrument note
transcription, and a lane-by-lane editor where you swap in a different kick, bass, or synth and hear
the song play back with your sound in place of the original.

> *"What's the bassline doing in the drop?"* · *"Swap the kick, keep everything else"* · *"Solo just the vocal and pad"*

## Features

- **Real stem separation.** Demucs + MDX23C DrumSep split the mix into kick, clap, hats, perc, bass,
  chords, pad, lead, and vocal — not a hand-labeled approximation.
- **Real note transcription.** Basic Pitch (melodic stems) and onset detection (drum stems) turn each
  separated stem into actual notes, not synthesized ones.
- **Solo, mute, and pick your lanes.** Listen to any combination — drums + bass, or just kick + hats + vocal.
- **Swap the sound.** Replace a lane's sample or synth preset and it plays back with the rest of the
  real track, in sync.
- **Section and energy map.** Bar-accurate structure (intro/build/drop/etc.) and an energy curve computed
  from the actual audio, not guessed.

## How it works

```
Song audio ──► Demucs / DrumSep (stems) ──► Basic Pitch / onsets (notes) ──► analysis.json ──► Web player
```

| Path | Role |
|---|---|
| `analysis/analyze.py` | Offline pipeline: stem separation, transcription, sections, energy, key, FLAC export |
| `src/audio/engine.ts` | Tone.js playback engine — real stem audio, swappable per-lane synths/samples |
| `src/components/Workspace.tsx` | Lane view: solo/mute, section markers, energy, playhead |
| `src/components/EditorDrawer.tsx` | Per-lane sound-swap editor |
| `public/songs/<id>/analysis.json` | Baked analysis output the web app reads (no backend) |

## Getting started

1. **Install**
   ```bash
   npm install --legacy-peer-deps
   ```
2. **Run the app**
   ```bash
   npm run dev   # http://localhost:5173
   ```
3. **(Optional) Re-run the analysis pipeline on your own track**
   ```bash
   cd analysis && pip install -r requirements.txt
   python analyze.py --song "<path to mp3/wav>" --out ../public/songs/<id>/ --id <id> --title "..." --artist "..."
   ```

The repo ships with one fully analyzed track (`public/songs/where-you-are/`) so the app runs out of the
box with no pipeline setup required.

## Status

This is the real-pipeline build: stem separation, transcription, and playback are genuine, computed offline
and baked into `analysis.json`. A second demo, exploring a mock-data "whiteboard" teardown view, lives on
the `teardown-demo` branch.

## Tech stack

React · TypeScript · Vite · Tone.js · Python (Demucs, Basic Pitch, librosa)
