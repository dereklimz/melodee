import * as Tone from 'tone';
import type { LaneId } from '../types/analysis';

export type InstrumentNode =
  | Tone.MembraneSynth
  | Tone.NoiseSynth
  | Tone.MetalSynth
  | Tone.MonoSynth
  | Tone.PolySynth
  | Tone.Synth;

export interface BuiltInstrument {
  trigger: (pitch: number, durSec: number, time: number, vel: number) => void;
  output: Tone.ToneAudioNode;
  dispose: () => void;
}

function midiToNote(pitch: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(pitch / 12) - 1;
  return `${names[pitch % 12]}${octave}`;
}

type PresetBuilder = () => BuiltInstrument;

function membrane(opts: Partial<ConstructorParameters<typeof Tone.MembraneSynth>[0]> = {}): PresetBuilder {
  return () => {
    const synth = new Tone.MembraneSynth({ octaves: 5, pitchDecay: 0.05, ...opts });
    return {
      trigger: (pitch, dur, time, vel) => synth.triggerAttackRelease(midiToNote(pitch), dur, time, vel),
      output: synth,
      dispose: () => synth.dispose(),
    };
  };
}

function noise(
  filterFreq: number,
  filterType: BiquadFilterType,
  env: Partial<ConstructorParameters<typeof Tone.NoiseSynth>[0]['envelope']> = {}
): PresetBuilder {
  return () => {
    const filter = new Tone.Filter(filterFreq, filterType);
    const synth = new Tone.NoiseSynth({
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, ...env },
    });
    synth.connect(filter);
    return {
      trigger: (_pitch, dur, time, vel) => synth.triggerAttackRelease(dur, time, vel),
      output: filter,
      dispose: () => {
        synth.dispose();
        filter.dispose();
      },
    };
  };
}

function metal(opts: Partial<ConstructorParameters<typeof Tone.MetalSynth>[0]> = {}): PresetBuilder {
  return () => {
    const synth = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.4, release: 0.1 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
      ...opts,
    });
    return {
      trigger: (pitch, dur, time, vel) => synth.triggerAttackRelease(dur, time, vel),
      output: synth,
      dispose: () => synth.dispose(),
    };
  };
}

function mono(opts: Partial<ConstructorParameters<typeof Tone.MonoSynth>[0]> = {}): PresetBuilder {
  return () => {
    const synth = new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.4 },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.6, baseFrequency: 200, octaves: 3 },
      ...opts,
    });
    return {
      trigger: (pitch, dur, time, vel) => synth.triggerAttackRelease(midiToNote(pitch), dur, time, vel),
      output: synth,
      dispose: () => synth.dispose(),
    };
  };
}

function poly(opts: Partial<ConstructorParameters<typeof Tone.Synth>[0]> = {}): PresetBuilder {
  return () => {
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.3, release: 0.6 },
      ...opts,
    } as never);
    return {
      trigger: (pitch, dur, time, vel) => synth.triggerAttackRelease(midiToNote(pitch), dur, time, vel),
      output: synth,
      dispose: () => synth.dispose(),
    };
  };
}

function lead(opts: Partial<ConstructorParameters<typeof Tone.Synth>[0]> = {}): PresetBuilder {
  return () => {
    const synth = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.3, release: 0.3 },
      ...opts,
    });
    return {
      trigger: (pitch, dur, time, vel) => synth.triggerAttackRelease(midiToNote(pitch), dur, time, vel),
      output: synth,
      dispose: () => synth.dispose(),
    };
  };
}

// Riser/sweep style: noise through a filter whose cutoff is swept up during
// the note, giving ear-candy events an actual "whoosh" character.
function sweep(direction: 'up' | 'down' = 'up'): PresetBuilder {
  return () => {
    const filter = new Tone.Filter(direction === 'up' ? 200 : 8000, 'bandpass');
    filter.Q.value = 1;
    const synth = new Tone.NoiseSynth({ envelope: { attack: 0.05, decay: 0.3, sustain: 0.2, release: 0.3 } });
    synth.connect(filter);
    return {
      trigger: (_pitch, dur, time, vel) => {
        const from = direction === 'up' ? 200 : 8000;
        const to = direction === 'up' ? 8000 : 200;
        filter.frequency.setValueAtTime(from, time);
        filter.frequency.exponentialRampToValueAtTime(Math.max(to, 20), time + dur);
        synth.triggerAttackRelease(dur, time, vel);
      },
      output: filter,
      dispose: () => {
        synth.dispose();
        filter.dispose();
      },
    };
  };
}

// preset key -> builder, per lane. "Original" is always index 0 conceptually
// (handled by the engine falling back to this table's first-listed preset).
export const PRESETS: Record<LaneId, Record<string, PresetBuilder>> = {
  kick: {
    Original: membrane({ pitchDecay: 0.05, octaves: 6, envelope: { attack: 0.001, decay: 0.35, sustain: 0.01, release: 0.4 } }),
    'Deep Kick': membrane({ pitchDecay: 0.08, octaves: 7, envelope: { attack: 0.001, decay: 0.5, sustain: 0.01, release: 0.5 } }),
    'Punchy Kick': membrane({ pitchDecay: 0.03, octaves: 4, envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.2 } }),
    'Sub Kick': membrane({ pitchDecay: 0.1, octaves: 8, envelope: { attack: 0.001, decay: 0.7, sustain: 0.05, release: 0.6 } }),
    'Clicky Kick': membrane({ pitchDecay: 0.02, octaves: 3, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.1 } }),
    'Analog Kick': membrane({ pitchDecay: 0.06, octaves: 5, oscillator: { type: 'triangle' } }),
  },
  clap: {
    Original: noise(1800, 'bandpass', { decay: 0.18 }),
    'Tight Clap': noise(2000, 'bandpass', { decay: 0.12 }),
    'Snappy Clap': noise(2500, 'bandpass', { decay: 0.08 }),
    'Layered Clap': noise(1600, 'bandpass', { decay: 0.22 }),
    'Vinyl Clap': noise(1200, 'lowpass', { decay: 0.2 }),
    '808 Clap': noise(1000, 'bandpass', { decay: 0.3 }),
  },
  hats: {
    Original: metal({ envelope: { attack: 0.001, decay: 0.08, release: 0.02 }, resonance: 5000 }),
    'Crisp Closed': metal({ envelope: { attack: 0.001, decay: 0.05, release: 0.01 }, resonance: 6000 }),
    'Dark Closed': metal({ envelope: { attack: 0.001, decay: 0.07, release: 0.02 }, resonance: 3500 }),
    'Metallic Closed': metal({ envelope: { attack: 0.001, decay: 0.06, release: 0.02 }, harmonicity: 8, resonance: 5500 }),
    'Bright Open': metal({ envelope: { attack: 0.001, decay: 0.35, release: 0.15 }, resonance: 6500 }),
    'Warm Open': metal({ envelope: { attack: 0.001, decay: 0.4, release: 0.2 }, resonance: 3000 }),
  },
  perc: {
    Original: metal({ envelope: { attack: 0.001, decay: 0.15, release: 0.05 }, resonance: 4500 }),
    Shaker: noise(4000, 'highpass', { decay: 0.1 }),
    Conga: membrane({ pitchDecay: 0.02, octaves: 2, envelope: { decay: 0.25 } }),
    Rimshot: metal({ envelope: { attack: 0.001, decay: 0.08, release: 0.02 }, resonance: 7000 }),
    'Tom Hit': membrane({ pitchDecay: 0.03, octaves: 3, envelope: { decay: 0.4 } }),
    Clave: metal({ envelope: { attack: 0.001, decay: 0.06, release: 0.01 }, resonance: 8000 }),
  },
  bass: {
    Original: mono({ oscillator: { type: 'sine' }, filterEnvelope: { baseFrequency: 150, octaves: 2.5 } }),
    'Warm Bass': mono({ oscillator: { type: 'sine' }, filterEnvelope: { baseFrequency: 180, octaves: 2 } }),
    'Bright Bass': mono({ oscillator: { type: 'sawtooth' }, filterEnvelope: { baseFrequency: 400, octaves: 3.5 } }),
    'Sub Bass': mono({ oscillator: { type: 'sine' }, filterEnvelope: { baseFrequency: 100, octaves: 1.5 } }),
    'Reese Bass': mono({ oscillator: { type: 'fatsawtooth' }, filterEnvelope: { baseFrequency: 300, octaves: 3 } }),
    'Pluck Bass': mono({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.15, sustain: 0.05, release: 0.15 } }),
  },
  chords: {
    Original: poly({ oscillator: { type: 'triangle' } }),
    'Punchy Stab': poly({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.005, decay: 0.15, sustain: 0.1, release: 0.2 } }),
    'Soft Stab': poly({ oscillator: { type: 'triangle' }, envelope: { attack: 0.02, decay: 0.25, sustain: 0.2, release: 0.4 } }),
    Piano: poly({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.5, sustain: 0.1, release: 0.8 } }),
    'Electric Piano': poly({ oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.4, sustain: 0.15, release: 0.6 } }),
    'Pluck Keys': poly({ oscillator: { type: 'square' }, envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.15 } }),
  },
  pad: {
    Original: poly({ oscillator: { type: 'sine' }, envelope: { attack: 0.8, decay: 0.5, sustain: 0.6, release: 1.5 } }),
    'Lush Pad': poly({ oscillator: { type: 'sine' }, envelope: { attack: 1, decay: 0.6, sustain: 0.7, release: 2 } }),
    'Ambient Pad': poly({ oscillator: { type: 'triangle' }, envelope: { attack: 1.5, decay: 0.8, sustain: 0.6, release: 2.5 } }),
    'Warm Strings': poly({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.6, decay: 0.4, sustain: 0.65, release: 1.2 } }),
    'Choir Pad': poly({ oscillator: { type: 'fatsine' }, envelope: { attack: 0.9, decay: 0.5, sustain: 0.6, release: 1.8 } }),
    'Analog Pad': poly({ oscillator: { type: 'fatsawtooth' }, envelope: { attack: 0.7, decay: 0.5, sustain: 0.55, release: 1.4 } }),
  },
  lead: {
    Original: lead({ oscillator: { type: 'sawtooth' } }),
    'Bright Synth': lead({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.4, release: 0.2 } }),
    Pluck: lead({ oscillator: { type: 'triangle' }, envelope: { attack: 0.002, decay: 0.15, sustain: 0, release: 0.1 } }),
    Supersaw: lead({ oscillator: { type: 'fatsawtooth' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3 } }),
    'Arp Sequence': lead({ oscillator: { type: 'square' }, envelope: { attack: 0.002, decay: 0.08, sustain: 0.1, release: 0.1 } }),
    'Vocal Chop Lead': lead({ oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.25 } }),
  },
  vocal: {
    Original: lead({ oscillator: { type: 'triangle' }, envelope: { attack: 0.03, decay: 0.15, sustain: 0.4, release: 0.3 } }),
    'Bright Chop': lead({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.2 } }),
    'Dark Chop': lead({ oscillator: { type: 'triangle' }, envelope: { attack: 0.02, decay: 0.15, sustain: 0.35, release: 0.3 } }),
    'Pitched Up Chop': lead({ oscillator: { type: 'square' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.25, release: 0.2 } }),
    'Airy Chop': lead({ oscillator: { type: 'fatsine' }, envelope: { attack: 0.05, decay: 0.2, sustain: 0.4, release: 0.4 } }),
    'Formant Chop': lead({ oscillator: { type: 'fatsawtooth' }, envelope: { attack: 0.02, decay: 0.15, sustain: 0.3, release: 0.25 } }),
  },
  'ear-candy': {
    Original: sweep('up'),
    'Subtle Riser': sweep('up'),
    'Hard Impact': metal({ envelope: { attack: 0.001, decay: 0.6, release: 0.3 }, resonance: 2000, harmonicity: 2 }),
    'White Noise Sweep': sweep('up'),
    'Reverse Cymbal': sweep('up'),
    Downlifter: sweep('down'),
  },
};

export function getPresetKeys(laneId: LaneId): string[] {
  return Object.keys(PRESETS[laneId] || {}).filter((k) => k !== 'Original');
}

export function buildInstrument(laneId: LaneId, presetKey: string): BuiltInstrument {
  const table = PRESETS[laneId];
  const builder = table?.[presetKey] || table?.Original;
  if (!builder) {
    // Absolute fallback so an unknown lane never crashes playback.
    return lead()();
  }
  return builder();
}
