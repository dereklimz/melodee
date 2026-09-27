import { useEffect, useState } from 'react';
import * as Tone from 'tone';
import { useAppStore } from '../store/app';
import { audioEngine } from '../audio/engine';
import { buildInstrument } from '../audio/presets';
import { laneColors } from '../styles/tokens';
import type { SampleLibrary, SampleEntry } from '../types/library';
import './EditorDrawer.css';

export function EditorDrawer() {
  const openLaneId = useAppStore((state) => state.openLaneId);
  const closeLane = useAppStore((state) => state.closeLane);
  const setLaneSound = useAppStore((state) => state.setLaneSound);
  const laneSounds = useAppStore((state) => state.laneSounds);
  const analysis = useAppStore((state) => state.analysis);

  const [library, setLibrary] = useState<SampleLibrary | null>(null);
  const [auditioning, setAuditioning] = useState<string | null>(null);

  useEffect(() => {
    fetch('/samples/library.json')
      .then((res) => res.json())
      .then((data) => setLibrary(data.lanes))
      .catch((err) => console.error('Failed to load sample library:', err));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openLaneId) closeLane();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openLaneId, closeLane]);

  if (!openLaneId || !analysis) return null;

  const lane = analysis.lanes.find((l) => l.id === openLaneId);
  if (!lane) return null;

  const laneColor = laneColors[openLaneId];
  const samples: SampleEntry[] = (library?.[openLaneId] || []).slice(0, 5);
  const currentSound = laneSounds[openLaneId] || 'Original';

  const audition = async (sample: SampleEntry) => {
    await audioEngine.ensureStarted();
    setAuditioning(sample.id);
    const preview = buildInstrument(openLaneId, sample.name);
    preview.output.toDestination();
    const previewPitch = sample.rootNote ?? 60;
    preview.trigger(previewPitch, 0.35, Tone.now(), 0.9);
    window.setTimeout(() => {
      preview.dispose();
      setAuditioning(null);
    }, 500);
  };

  const useSample = (sample: SampleEntry) => {
    setLaneSound(openLaneId, sample.name);
    audioEngine.swapInstrument(openLaneId, sample.name);
  };

  const useOriginal = () => {
    setLaneSound(openLaneId, 'Original');
    audioEngine.swapInstrument(openLaneId, 'Original');
  };

  const shuffleSound = () => {
    if (samples.length === 0) return;
    const currentIdx = samples.findIndex((s) => s.name === currentSound);
    const pool = samples.filter((_, i) => i !== currentIdx);
    const pick = (pool.length > 0 ? pool : samples)[Math.floor(Math.random() * (pool.length > 0 ? pool.length : samples.length))];
    useSample(pick);
  };

  return (
    <div className="editor-drawer-overlay" onClick={closeLane}>
      <div className="editor-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="editor-drawer-header">
          <div className="editor-drawer-title">
            <div className="editor-drawer-swatch" style={{ backgroundColor: laneColor }} />
            <h2>{lane.name}</h2>
          </div>
          <button className="editor-drawer-close" onClick={closeLane}>
            Esc ✕
          </button>
        </div>

        <div className="editor-drawer-body">
          <div className="sound-panel">
            <div className="sound-panel-label">Sound</div>
            <div className="sound-list">
              <button
                className={`sound-item ${currentSound === 'Original' ? 'active' : ''}`}
                onClick={useOriginal}
              >
                <span className="sound-item-name">Original</span>
                {currentSound === 'Original' && <span className="sound-item-check">✓</span>}
              </button>

              {samples.length === 0 && (
                <div className="sound-empty">No samples found for this lane yet.</div>
              )}

              {samples.map((sample) => (
                <div
                  key={sample.id}
                  className={`sound-item ${currentSound === sample.name ? 'active' : ''}`}
                >
                  <button
                    className="sound-item-audition"
                    onClick={() => audition(sample)}
                    title="Audition"
                  >
                    {auditioning === sample.id ? '●' : '▶'}
                  </button>
                  <span className="sound-item-name">{sample.name}</span>
                  {sample.tag && <span className="sound-item-tag">{sample.tag}</span>}
                  <button className="sound-item-use" onClick={() => useSample(sample)}>
                    {currentSound === sample.name ? '✓ Used' : 'Use'}
                  </button>
                </div>
              ))}

              <button className="shuffle-btn" onClick={shuffleSound}>
                Shuffle sound
              </button>
            </div>
          </div>

          <div className="notes-panel">
            <div className="notes-panel-label">Notes</div>
            <div className="notes-panel-placeholder">
              Piano roll editing lands in the Editor milestone — for now, pick a sound on the left.
            </div>
          </div>

          <div className="groove-panel">
            <div className="groove-panel-label">Groove</div>
            <div className="groove-control">
              <label>Swing</label>
              <input type="range" min="0" max="75" defaultValue="0" />
            </div>
            <div className="groove-control">
              <label>Rate</label>
              <div className="rate-buttons">
                <button className="rate-btn">½×</button>
                <button className="rate-btn active">1×</button>
                <button className="rate-btn">2×</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
