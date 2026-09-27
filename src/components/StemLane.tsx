import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/app';
import { audioEngine } from '../audio/engine';
import { laneColors, colors } from '../styles/tokens';
import { seekToBar } from '../utils/seek';
import type { Lane, LaneId } from '../types/analysis';
import './StemLane.css';

const DRUM_LANES = new Set<LaneId>(['kick', 'clap', 'hats', 'perc']);

interface StemLaneProps {
  lane: Lane;
  currentSound?: string | null;
  onOpen?: () => void;
}

export function StemLane({ lane, currentSound, onOpen }: StemLaneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analysis = useAppStore((state) => state.analysis);
  const isMuted = useAppStore((state) => state.laneMuted[lane.id]);
  const isSoloed = useAppStore((state) => state.laneSoloed[lane.id]);
  const toggleLaneMute = useAppStore((state) => state.toggleLaneMute);
  const toggleLaneSolo = useAppStore((state) => state.toggleLaneSolo);
  const laneColor = laneColors[lane.id];

  useEffect(() => {
    if (!canvasRef.current || !analysis) return;
    const canvas = canvasRef.current;

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const totalBeats = analysis.song.bars * 4;
      const pxPerBeat = width / totalBeats;
      const barWidth = width / analysis.song.bars;

      ctx.fillStyle = colors.ground;
      ctx.fillRect(0, 0, width, height);

      for (let bar = 0; bar < analysis.song.bars; bar++) {
        if (bar % 8 >= 4) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
          ctx.fillRect(bar * barWidth, 0, barWidth, height);
        }
      }

      const allNotes = lane.clips.flatMap((c) => c.notes);

      if (allNotes.length > 0) {
        if (DRUM_LANES.has(lane.id)) {
          const maxTickHeight = height - 10;
          allNotes.forEach((note) => {
            const x = note.beat * pxPerBeat;
            const vel = Math.max(note.vel, 0) / 100;
            const tickHeight = 5 + vel * maxTickHeight * 0.82;
            const tickWidth = Math.max(pxPerBeat * note.durBeats * 0.45, 2);
            const y = height - 5 - tickHeight;
            const grad = ctx.createLinearGradient(0, y, 0, y + tickHeight);
            grad.addColorStop(0, laneColor);
            grad.addColorStop(1, `${laneColor}99`);
            ctx.fillStyle = grad;
            ctx.globalAlpha = 0.65 + vel * 0.35;
            ctx.beginPath();
            ctx.roundRect(x, y, tickWidth, tickHeight, Math.min(1.5, tickWidth / 2));
            ctx.fill();
          });
          ctx.globalAlpha = 1;
        } else {
          const pitches = allNotes.map((n) => n.pitch);
          const minPitch = Math.min(...pitches) - 1;
          const maxPitch = Math.max(...pitches) + 1;
          const pitchRange = Math.max(maxPitch - minPitch, 1);
          const noteHeight = Math.max(Math.min(height / 9, 4.5), 2.5);
          const topPad = 5;
          const usableHeight = height - topPad * 2;

          allNotes.forEach((note) => {
            const x = note.beat * pxPerBeat;
            const noteWidth = Math.max(note.durBeats * pxPerBeat - 1, 2.5);
            const yFrac = 1 - (note.pitch - minPitch) / pitchRange;
            const y = topPad + yFrac * (usableHeight - noteHeight);
            const vel = Math.max(note.vel, 0) / 100;
            const r = Math.min(1.8, noteHeight / 2);

            // subtle glow for higher-velocity notes
            if (vel > 0.6) {
              ctx.save();
              ctx.shadowColor = laneColor;
              ctx.shadowBlur = 3;
            }
            const grad = ctx.createLinearGradient(x, y, x, y + noteHeight);
            grad.addColorStop(0, `${laneColor}FF`);
            grad.addColorStop(1, `${laneColor}CC`);
            ctx.fillStyle = grad;
            ctx.globalAlpha = 0.55 + vel * 0.45;
            ctx.beginPath();
            ctx.roundRect(x, y, noteWidth, noteHeight, r);
            ctx.fill();
            if (vel > 0.6) ctx.restore();
          });
          ctx.globalAlpha = 1;
        }
      } else if (lane.barIntensity && lane.barIntensity.length > 0) {
        const inset = 1;
        lane.barIntensity.forEach((intensity, i) => {
          if (intensity <= 0.02) return;
          const x = i * barWidth;
          ctx.globalAlpha = 0.18 + intensity * 0.75;
          ctx.fillStyle = laneColor;
          ctx.fillRect(x + inset, 3, Math.max(barWidth - inset * 2, 1), height - 6);
        });
        ctx.globalAlpha = 1;
      }

      // Bar divisions, brighter every 8 bars to echo the song line ruler
      for (let bar = 0; bar <= analysis.song.bars; bar++) {
        const x = (bar / analysis.song.bars) * width;
        ctx.strokeStyle = bar % 8 === 0 ? 'rgba(255,255,255,0.07)' : colors.line;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [analysis, lane, laneColor]);

  const isChanged = currentSound && currentSound !== 'Original';

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!analysis) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    seekToBar(frac * analysis.song.bars);
  };

  return (
    <div className="stem-lane">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '42px', display: 'block', flex: 1, cursor: 'pointer' }}
        onClick={handleCanvasClick}
      />
      <div className="stem-lane-header" onClick={onOpen}>
        <div className="stem-lane-swatch" style={{ backgroundColor: laneColor, boxShadow: `0 0 6px ${laneColor}80` }} />
        <div className="stem-lane-name-col">
          <div className="stem-lane-name">{lane.name}</div>
          <div className={`stem-lane-sound ${isChanged ? 'changed' : ''}`}>
            {currentSound || 'Original'}
          </div>
        </div>
        <div className="stem-lane-controls">
          <button
            className={`lane-btn ${isMuted ? 'active-mute' : ''}`}
            title="Mute"
            onClick={(e) => {
              e.stopPropagation();
              toggleLaneMute(lane.id);
              audioEngine.setMute(lane.id, !isMuted);
            }}
          >
            M
          </button>
          <button
            className={`lane-btn ${isSoloed ? 'active-solo' : ''}`}
            title="Solo"
            onClick={(e) => {
              e.stopPropagation();
              toggleLaneSolo(lane.id);
              audioEngine.setSolo(lane.id, !isSoloed);
            }}
          >
            S
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            defaultValue="1"
            className="lane-volume"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => audioEngine.setLaneVolume(lane.id, Number(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
