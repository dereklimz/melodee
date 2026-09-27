import type { ElementFamily, SectionType } from '../types/track';

export type Gradient = [string, string];

/** Lane order and colours follow the spec's palette. */
export const FAMILY_ORDER: ElementFamily[] = ['kick', 'drums', 'bass', 'synth', 'vocal', 'fx'];

export const FAMILY_LABEL: Record<ElementFamily, string> = {
  kick: 'Kick',
  drums: 'Top drums',
  bass: 'Bass',
  synth: 'Synths',
  vocal: 'Vocals',
  fx: 'FX',
};

export const FAMILY_GRADIENT: Record<ElementFamily, Gradient> = {
  kick: ['#F0509A', '#7B2FF7'],
  drums: ['#F7B733', '#FC6A3A'],
  bass: ['#43E5C0', '#38B2E0'],
  synth: ['#4FACFE', '#6A5AF9'],
  vocal: ['#8BD94A', '#38B2E0'],
  fx: ['#F0509A', '#F7B733'],
};

export const SECTION_STYLE: Record<SectionType, { gradient: Gradient; text: string; label: string }> = {
  intro: { gradient: ['#5F5BC2', '#443F9E'], text: '#FFFFFF', label: 'Intro' },
  verse: { gradient: ['#4FACFE', '#6A5AF9'], text: '#14164A', label: 'Verse' },
  break: { gradient: ['#43E5C0', '#38B2E0'], text: '#14164A', label: 'Break' },
  build: { gradient: ['#F7B733', '#FC6A3A'], text: '#14164A', label: 'Build' },
  drop: { gradient: ['#F0509A', '#7B2FF7'], text: '#FFFFFF', label: 'Drop' },
  post_drop: { gradient: ['#F0509A', '#F7B733'], text: '#14164A', label: 'Post drop' },
  outro: { gradient: ['#5F5BC2', '#443F9E'], text: '#FFFFFF', label: 'Outro' },
};

export const COLOR = {
  bg: '#1C1F5A',
  surface: '#2E2B73',
  text: '#FFFFFF',
  textSecondary: '#B8B5E0',
};

/** Cycles the palette so each library row gets its own artwork gradient. */
export const ARTWORK: Gradient[] = [FAMILY_GRADIENT.kick, FAMILY_GRADIENT.bass, FAMILY_GRADIENT.drums, FAMILY_GRADIENT.synth, FAMILY_GRADIENT.vocal];
