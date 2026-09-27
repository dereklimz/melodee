import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/app';
import { colors } from '../styles/tokens';
import { seekToBar } from '../utils/seek';

export function SongLine() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analysis = useAppStore((state) => state.analysis);

  useEffect(() => {
    if (!canvasRef.current || !analysis) return;
    const canvas = canvasRef.current;

    const draw = () => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    ctx.scale(dpr, dpr);

    const width = cssWidth;
    const height = cssHeight;
    const padding = 22;
    const waveAreaHeight = height - padding;
    const centerY = waveAreaHeight / 2 + 4;
    const waveHeight = waveAreaHeight / 2 - 8;

    ctx.clearRect(0, 0, width, height);

    // Panel background with a very subtle vertical gradient for depth.
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, colors.panel);
    bgGrad.addColorStop(1, '#12151A');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const peaks = analysis.waveformPeaks;
    const peaksPerPixel = peaks.length / width;

    // Smooth the raw peaks slightly so bars read as a waveform, not noise.
    const smoothed: number[] = [];
    for (let x = 0; x < width; x++) {
      const idx = x * peaksPerPixel;
      const i0 = Math.floor(idx);
      const i1 = Math.min(i0 + 1, peaks.length - 1);
      const frac = idx - i0;
      const v = (peaks[i0] || 0) * (1 - frac) + (peaks[i1] || 0) * frac;
      smoothed.push(v);
    }

    // Mirrored bar waveform: thin rounded bars, denser + more modern than
    // a filled path, and reads clearly against the dark panel.
    const barGap = 1;
    const barWidth = Math.max(1.4, 2 - barGap);
    const grad = ctx.createLinearGradient(0, centerY - waveHeight, 0, centerY + waveHeight);
    grad.addColorStop(0, colors.accent);
    grad.addColorStop(0.5, '#FFD98A');
    grad.addColorStop(1, colors.accent);
    ctx.fillStyle = grad;

    for (let x = 0; x < width; x += barWidth + barGap) {
      const v = Math.max(smoothed[Math.floor(x)] || 0, 0.03);
      const h = v * waveHeight;
      const r = Math.min(barWidth / 2, h);
      ctx.beginPath();
      ctx.roundRect(x, centerY - h, barWidth, h * 2, r);
      ctx.fill();
    }

    // Soft center reflection line
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Bar ruler
    ctx.fillStyle = colors.muted;
    ctx.font = '10.5px ui-monospace, "SF Mono", monospace';
    ctx.textAlign = 'center';

    const tickHeight = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(0, height - padding + 0.5);
    ctx.lineTo(width, height - padding + 0.5);
    ctx.stroke();

    for (let bar = 0; bar <= analysis.song.bars; bar++) {
      const x = (bar / analysis.song.bars) * width;
      if (bar % 8 === 0) {
        ctx.fillStyle = 'rgba(232,235,240,0.35)';
        ctx.fillRect(x - 0.5, height - padding + 4, 1, tickHeight + 3);
        if (bar > 0) {
          ctx.fillStyle = colors.muted;
          ctx.fillText(bar.toString(), x, height - 4);
        }
      } else if (bar % 4 === 0) {
        ctx.fillStyle = 'rgba(232,235,240,0.15)';
        ctx.fillRect(x - 0.5, height - padding + 4, 1, tickHeight);
      }
    }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [analysis]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!analysis) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    seekToBar(frac * analysis.song.bars);
  };

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '80px', display: 'block', cursor: 'pointer' }}
      onClick={handleClick}
    />
  );
}
