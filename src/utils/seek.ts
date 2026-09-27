import { audioEngine } from '../audio/engine';
import { useAppStore } from '../store/app';

/** Seeks playback and immediately updates the shared playhead position
 * (rather than waiting for the next engine position-tick), so clicking
 * anywhere on the timeline feels instant. */
export function seekToBar(bar: number) {
  audioEngine.seekToBar(bar);
  useAppStore.getState().setCurrentPosition(Math.floor(bar), (bar % 1) * 4);
}
