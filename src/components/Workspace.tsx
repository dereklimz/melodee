import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/app';
import { audioEngine } from '../audio/engine';
import { SongLine } from './SongLine';
import { Structure } from './Structure';
import { Energy } from './Energy';
import { StemGroups } from './StemGroups';
import { Playhead } from './Playhead';
import { AnalysisAnimation } from './AnalysisAnimation';
import { EditorDrawer } from './EditorDrawer';
import './Workspace.css';

interface WorkspaceProps {
  onReset: () => void;
}

function formatPosition(bar: number, beat: number, bpm: number): string {
  const totalBeats = bar * 4 + beat;
  const sec = totalBeats * (60 / bpm);
  const mm = Math.floor(sec / 60);
  const ss = Math.floor(sec % 60);
  return `${bar + 1}.${Math.floor(beat) + 1} • ${mm}:${ss.toString().padStart(2, '0')}`;
}

export function Workspace({ onReset }: WorkspaceProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAnimation, setShowAnimation] = useState(true);
  const analysis = useAppStore((state) => state.analysis);
  const openLaneId = useAppStore((state) => state.openLaneId);
  const currentBar = useAppStore((state) => state.currentBar);
  const currentBeat = useAppStore((state) => state.currentBeat);
  const setCurrentPosition = useAppStore((state) => state.setCurrentPosition);
  const loopRange = useAppStore((state) => state.loopRange);
  const setLoopRange = useAppStore((state) => state.setLoopRange);

  const handlePlayPause = useCallback(async () => {
    if (isPlaying) {
      audioEngine.pause();
      setIsPlaying(false);
    } else {
      await audioEngine.play((bar, beat) => setCurrentPosition(bar, beat));
      setIsPlaying(true);
    }
  }, [isPlaying, setCurrentPosition]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && showAnimation) {
        setShowAnimation(false);
        return;
      }
      if (showAnimation || openLaneId) return;
      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAnimation, openLaneId, handlePlayPause]);

  if (!analysis) return null;

  const totalBars = analysis.song.bars;

  const handleMasterVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    audioEngine.setMasterVolume(Number(e.target.value));
  };

  const toggleWholeSongLoop = () => {
    if (loopRange) {
      setLoopRange(null);
      audioEngine.setLoop(null);
    } else {
      const range = { startBar: 0, endBar: totalBars };
      setLoopRange(range);
      audioEngine.setLoop(range);
    }
  };

  return (
    <div className="workspace">
      {showAnimation && <AnalysisAnimation onComplete={() => setShowAnimation(false)} />}

      <div className="header">
        <div className="header-left">
          <h1 className="product-name">melodee</h1>
          <div className="header-info">
            <span className="info-chip">
              {analysis.song.title} — {analysis.song.artist}
            </span>
            <span className="info-chip mono">{analysis.song.bpm} BPM</span>
            <span className="info-chip mono">
              {analysis.song.key.tonic} {analysis.song.key.mode.charAt(0).toUpperCase() + analysis.song.key.mode.slice(1)}
            </span>
          </div>
        </div>

        <div className="header-controls">
          <button className="btn">A/B</button>
          <button className="btn">Export MIDI</button>
          <button className="btn" onClick={onReset}>
            Reset demo
          </button>
        </div>
      </div>

      <div className="main">
        <div className="main-content">
          <SongLine />
          <Structure />
          <Energy />
          <StemGroups />
          <Playhead />
        </div>
      </div>

      <div className="transport">
        <button className="btn play-btn" onClick={handlePlayPause}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <div className="position mono">{formatPosition(currentBar, currentBeat, analysis.song.bpm)}</div>
        <button
          className={`btn loop-toggle ${loopRange ? 'active' : ''}`}
          onClick={toggleWholeSongLoop}
          title={loopRange ? 'Loop on — click to turn off' : 'Loop the whole song'}
        >
          Loop
        </button>
        <div className="transport-spacer" />
        <span className="volume-label mono">VOL</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          defaultValue="1"
          className="master-volume"
          onChange={handleMasterVolume}
        />
      </div>

      <EditorDrawer />
    </div>
  );
}
