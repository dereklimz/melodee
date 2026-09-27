import { create } from 'zustand';
import type { Analysis, LaneId } from '../types/analysis';

interface AppState {
  analysis: Analysis | null;
  isLoaded: boolean;
  isAnimating: boolean;
  isPlaying: boolean;
  currentBar: number;
  currentBeat: number;
  masterVolume: number;

  /** Lane whose editor drawer is open, if any. */
  openLaneId: LaneId | null;
  /** Chosen sample name per lane (name shown in place of "Original"). */
  laneSounds: Partial<Record<LaneId, string>>;
  laneMuted: Partial<Record<LaneId, boolean>>;
  laneSoloed: Partial<Record<LaneId, boolean>>;
  /** Active loop range in bars, or null for no loop. */
  loopRange: { startBar: number; endBar: number } | null;

  setAnalysis: (analysis: Analysis) => void;
  setIsLoaded: (loaded: boolean) => void;
  setIsAnimating: (animating: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentPosition: (bar: number, beat: number) => void;
  setMasterVolume: (volume: number) => void;
  openLane: (laneId: LaneId) => void;
  closeLane: () => void;
  setLaneSound: (laneId: LaneId, soundName: string) => void;
  toggleLaneMute: (laneId: LaneId) => void;
  toggleLaneSolo: (laneId: LaneId) => void;
  setLoopRange: (range: { startBar: number; endBar: number } | null) => void;
  reset: () => void;
}

const initialState = {
  analysis: null,
  isLoaded: false,
  isAnimating: false,
  isPlaying: false,
  currentBar: 0,
  currentBeat: 0,
  masterVolume: 1,
  openLaneId: null,
  laneSounds: {},
  laneMuted: {},
  laneSoloed: {},
  loopRange: null,
};

export const useAppStore = create<AppState>((set) => ({
  ...initialState,

  setAnalysis: (analysis) => set({ analysis }),
  setIsLoaded: (loaded) => set({ isLoaded: loaded }),
  setIsAnimating: (animating) => set({ isAnimating: animating }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentPosition: (bar, beat) => set({ currentBar: bar, currentBeat: beat }),
  setMasterVolume: (volume) => set({ masterVolume: volume }),
  openLane: (laneId) => set({ openLaneId: laneId }),
  closeLane: () => set({ openLaneId: null }),
  setLaneSound: (laneId, soundName) =>
    set((state) => ({ laneSounds: { ...state.laneSounds, [laneId]: soundName } })),
  toggleLaneMute: (laneId) =>
    set((state) => ({ laneMuted: { ...state.laneMuted, [laneId]: !state.laneMuted[laneId] } })),
  toggleLaneSolo: (laneId) =>
    set((state) => ({ laneSoloed: { ...state.laneSoloed, [laneId]: !state.laneSoloed[laneId] } })),
  setLoopRange: (range) => set({ loopRange: range }),
  reset: () => set({ ...initialState, laneSounds: {}, laneMuted: {}, laneSoloed: {}, loopRange: null }),
}));
