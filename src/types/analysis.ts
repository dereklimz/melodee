export type SectionType = 'intro' | 'build' | 'drop' | 'breakdown' | 'break' | 'bridge' | 'outro';
export type EnergyLevel = 'low' | 'medium' | 'high';
export type EarCandyType = 'riser' | 'impact' | 'reverse_cymbal' | 'sweep' | 'drum_fill' | 'vocal_throw' | 'tape_stop' | 'silence_gap';
export type LaneId = 'kick' | 'clap' | 'hats' | 'perc' | 'bass' | 'chords' | 'pad' | 'lead' | 'vocal' | 'ear-candy';

export interface Key {
  tonic: string;
  mode: 'major' | 'minor';
  camelot: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  durationSec: number;
  bpm: number;
  timeSignature: [number, number];
  firstDownbeatSec: number;
  bars: number;
  key: Key;
  lufsIntegrated: number;
  genre: string;
}

export interface Section {
  id: string;
  type: SectionType;
  label: string;
  startBar: number;
  endBar: number;
  energyLevel: EnergyLevel;
}

export interface EnergyPoint {
  beat: number;
  value: number;
}

export interface Chord {
  bar: number;
  symbol: string;
  root: string;
  pitches: number[];
}

export interface Stem {
  id: string;
  file: string;
  channels: 1 | 2;
}

export interface Note {
  beat: number;
  pitch: number;
  durBeats: number;
  vel: number;
}

export interface Clip {
  id: string;
  sectionId: string;
  startBar: number;
  endBar: number;
  notes: Note[];
  /** 0–1 average activity for this clip, from spectral-intensity analysis (real data has no per-note MIDI). */
  avgIntensity?: number;
  sourceInstrument?: string;
}

export interface Lane {
  id: LaneId;
  name: string;
  stemId: string | null;
  sharedWith: LaneId[];
  clips: Clip[];
  /** 0–1 activity per bar (length === song.bars), for opacity-shaded lane rendering. */
  barIntensity?: number[];
}

export interface EarCandyEvent {
  beat: number;
  type: EarCandyType;
  durBeats: number;
  label: string;
}

export interface Analysis {
  song: Song;
  waveformPeaks: number[];
  /** Optional real waveform image (PNG), rendered in place of procedural peaks when present. */
  waveformImage?: string;
  sections: Section[];
  energy: EnergyPoint[];
  chords: Chord[];
  stems: Stem[];
  lanes: Lane[];
  events: EarCandyEvent[];
}
