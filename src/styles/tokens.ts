export const colors = {
  // Surfaces
  ground: '#0E1013',
  panel: '#15181D',
  raised: '#1C2027',
  line: '#262B33',

  // Text
  text: '#E8EBF0',
  muted: '#8B94A3',

  // Accent
  accent: '#F5B84B',

  // Lanes
  kick: '#FF6A55',
  clap: '#FF9A4D',
  hats: '#FFD04D',
  perc: '#E79BF2',
  bass: '#8C7CFF',
  chords: '#4FC3F7',
  pad: '#3DD6B5',
  lead: '#A6E36B',
  vocal: '#FF7EB6',
  earCandy: '#CFD6E0',

  // Section types
  sectionIntroOutro: '#3A4250',
  sectionBuild: '#B7852E',
  sectionDrop: '#D2553F',
  sectionBreakdown: '#2F8F9D',
  sectionBridge: '#6B5BD2',
};

export const laneColors: Record<string, string> = {
  kick: colors.kick,
  clap: colors.clap,
  hats: colors.hats,
  perc: colors.perc,
  bass: colors.bass,
  chords: colors.chords,
  pad: colors.pad,
  lead: colors.lead,
  vocal: colors.vocal,
  'ear-candy': colors.earCandy,
};

export const sectionTypeColors: Record<string, string> = {
  intro: colors.sectionIntroOutro,
  outro: colors.sectionIntroOutro,
  build: colors.sectionBuild,
  drop: colors.sectionDrop,
  breakdown: colors.sectionBreakdown,
  break: colors.sectionBreakdown,
  bridge: colors.sectionBridge,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 2,
  md: 4,
  lg: 8,
};

export const heights = {
  header: 64,
  songLine: 56,
  structure: 36,
  energy: 110,
  lane: 38,
  transport: 56,
};
