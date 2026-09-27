import { useAppStore } from '../store/app';
import './Playhead.css';

export function Playhead() {
  const analysis = useAppStore((state) => state.analysis);
  const currentBar = useAppStore((state) => state.currentBar);
  const currentBeat = useAppStore((state) => state.currentBeat);

  if (!analysis) return null;

  const totalBars = analysis.song.bars;
  const positionBars = currentBar + currentBeat / 4;
  const leftPercent = (positionBars / totalBars) * 100;

  return <div className="playhead" style={{ left: `${leftPercent}%` }} />;
}
