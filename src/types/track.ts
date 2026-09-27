export const SECTION_TYPES = ['intro', 'verse', 'break', 'build', 'drop', 'post_drop', 'outro'] as const;
export const ENERGY_SHAPES = ['flat', 'ramp_up', 'ramp_down', 'dip'] as const;
export const ELEMENT_FAMILIES = ['kick', 'drums', 'bass', 'synth', 'vocal', 'fx'] as const;
export const EDGE_TYPES = ['cut', 'fade', 'highpass_sweep', 'lowpass_sweep', 'reverb_wash'] as const;
export const MOVEMENT_DIMENSIONS = ['volume', 'frequency', 'spatial'] as const;
export const MOVEMENT_TYPES = [
  'fade_up',
  'fade_down',
  'lowpass_open',
  'lowpass_close',
  'highpass_open',
  'highpass_close',
  'reverb_up',
  'reverb_down',
  'delay_throw',
] as const;
export const FX_TYPES = ['riser', 'downlifter', 'crash', 'impact', 'reverse_cymbal'] as const;

export type SectionType = (typeof SECTION_TYPES)[number];
export type EnergyShape = (typeof ENERGY_SHAPES)[number];
export type ElementFamily = (typeof ELEMENT_FAMILIES)[number];
export type EdgeType = (typeof EDGE_TYPES)[number];
export type MovementDimension = (typeof MOVEMENT_DIMENSIONS)[number];
export type MovementType = (typeof MOVEMENT_TYPES)[number];
export type FxType = (typeof FX_TYPES)[number];

/** Arrangement dimensions from the teardown whiteboard, used by the filter. */
export type Dimension = 'time' | 'harmony' | 'volume' | 'frequency' | 'spatial' | 'fx';

/** All positions are in bars, 1-indexed, endBar inclusive. */
export interface TrackInfo {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  key: string;
  totalBars: number;
  audioUrl?: string;
  firstDownbeatSec: number;
}

export interface Section {
  type: SectionType;
  label: string;
  startBar: number;
  endBar: number;
}

export interface EnergySegment {
  startBar: number;
  endBar: number;
  /** Relative intensity 0-1 (ranks sections against each other, not loudness). */
  level: number;
  shape: EnergyShape;
}

export interface HarmonySegment {
  mode: 'root' | 'progression';
  startBar: number;
  endBar: number;
}

export interface Harmony {
  progression: string[];
  /** Bars each chord lasts while in progression mode. Defaults to 2. */
  barsPerChord?: number;
  segments: HarmonySegment[];
}

/** How a block enters or leaves. `bars` is the length of the fade/sweep/wash. */
export interface Edge {
  type: EdgeType;
  bars?: number;
}

export interface Movement {
  dimension: MovementDimension;
  type: MovementType;
  startBar: number;
  endBar: number;
}

/** Chord tone a note is built from; resolved against the chord playing at that bar. */
export type ChordTone = 'r' | '3' | '5' | '7' | '8';

/** One note (or a stacked chord shape when `tone` is an array), positioned in 16th-note steps. */
export interface NoteStep {
  step: number;
  len: number;
  tone: ChordTone | ChordTone[];
  /** Octave shift on top of the element's base octave. */
  oct?: number;
}

/** Drum pattern: which 16th-note steps are on, per voice (e.g. clap, hat). */
export interface HitPattern {
  kind: 'hits';
  lengthBars?: number;
  voices: Record<string, number[]>;
}

/** Melodic pattern expressed in chord tones, so notes follow the progression. */
export interface NotePattern {
  kind: 'notes';
  lengthBars?: number;
  notes: NoteStep[];
}

export type Pattern = HitPattern | NotePattern;

export interface PatternOverride {
  startBar: number;
  endBar: number;
  pattern: string;
}

export interface Block {
  startBar: number;
  endBar: number;
  /** Below 0.6 the block renders with a dashed outline. */
  confidence: number;
  entry: Edge;
  exit: Edge;
  movements?: Movement[];
  /** Id of a pattern in the element's `patterns`; what the element plays inside the block. */
  pattern?: string;
  /** Swap to a different pattern for part of the block (fills, rolls, breakdown variants). */
  overrides?: PatternOverride[];
}

export interface Element {
  id: string;
  name: string;
  family: ElementFamily;
  patterns?: Record<string, Pattern>;
  blocks: Block[];
}

export interface FxEvent {
  type: FxType;
  /** Range events (risers, downlifters). */
  startBar?: number;
  endBar?: number;
  /** Point events (crashes, impacts). */
  bar?: number;
}

export interface Track {
  track: TrackInfo;
  sections: Section[];
  energy: EnergySegment[];
  harmony: Harmony;
  elements: Element[];
  fxEvents: FxEvent[];
}

export const LOW_CONFIDENCE = 0.6;
export const STEPS_PER_BAR = 16;
