import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/app';
import { colors } from '../styles/tokens';
import { seekToBar } from '../utils/seek';

function lerpColor(a: [number, number, number], b: [number, number, number], t: number) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// Cool -> warm as energy rises, per spec.
const COOL: [number, number, number] = [79, 195, 247]; // #4FC3F7
const WARM: [number, number, number] = [245, 184, 75]; // accent
const HOT: [number, number, number] = [255, 106, 85]; // #FF6A55

function energyColor(v: number) {
  const t = Math.max(0, Math.min(1, v / 100));
  const rgb = t < 0.6 ? lerpColor(COOL, WARM, t / 0.6) : lerpColor(WARM, HOT, (t - 0.6) / 0.4);
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export function Energy() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analysis = useAppStore((state) => state.analysis);

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

      const padding = 10;
      const graphHeight = height - padding * 2;

      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, colors.panel);
      bgGrad.addColorStop(1, '#12151A');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Energy bands, subtly separated
      const bandHeight = graphHeight / 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        const y = padding + bandHeight * i;
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(width, y + 0.5);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(139, 148, 163, 0.55)';
      ctx.font = '10px ui-monospace, "SF Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('HIGH', width - 6, padding + 10);
      ctx.fillText('MED', width - 6, padding + bandHeight * 1.5 + 3);
      ctx.fillText('LOW', width - 6, height - padding - 2);

      const energyPoints = analysis.energy;
      if (energyPoints.length === 0) return;

      const maxBeat = analysis.song.bars * 4;
      const points = energyPoints.map((ep) => ({
        x: (ep.beat / maxBeat) * width,
        y: height - padding - (ep.value / 100) * graphHeight,
        value: ep.value,
      }));

      // Area fill: gradient from transparent to a soft warm glow, clipped to
      // the curve shape via a path.
      const fillGrad = ctx.createLinearGradient(0, padding, 0, height - padding);
      fillGrad.addColorStop(0, 'rgba(245, 184, 75, 0.22)');
      fillGrad.addColorStop(1, 'rgba(245, 184, 75, 0.02)');
      ctx.fillStyle = fillGrad;
      ctx.beginPath();
      ctx.moveTo(points[0].x, height - padding);
      points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length - 1].x, height - padding);
      ctx.closePath();
      ctx.fill();

      // Curve: color shifts cool->warm->hot with energy level, drawn as
      // short colored segments for a smooth gradient-along-path effect.
      ctx.lineWidth = 2.25;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (let i = 1; i < points.length; i++) {
        ctx.strokeStyle = energyColor((points[i - 1].value + points[i].value) / 2);
        ctx.beginPath();
        ctx.moveTo(points[i - 1].x, points[i - 1].y);
        ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
      }

      // Soft glow along the peak of the curve
      ctx.save();
      ctx.shadowColor = 'rgba(245, 184, 75, 0.35)';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = 'rgba(255,255,255,0.0)';
      ctx.restore();
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
      style={{ width: '100%', height: '110px', display: 'block', cursor: 'pointer' }}
      onClick={handleClick}
    />
  );
}
