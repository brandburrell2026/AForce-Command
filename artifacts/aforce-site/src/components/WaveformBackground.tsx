import { useEffect, useRef } from 'react';

/**
 * Ambient low-frequency waveform painted behind the hero. Respects
 * `prefers-reduced-motion`: when reduced motion is requested we paint a
 * single static frame and do not start the rAF loop.
 */
export function WaveformBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    let rafId = 0;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const paint = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      // primary wave
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      for (let x = 0; x < width; x++) {
        const y1 = Math.sin((x * 0.002) + t * 0.5) * 50;
        const y2 = Math.sin((x * 0.005) + t * 0.3) * 20;
        const y3 = Math.sin((x * 0.001) - t * 0.2) * 100;
        const d = Math.abs(x - width / 2) / (width / 2);
        const attenuation = Math.max(0, 1 - Math.pow(d, 2));
        ctx.lineTo(x, centerY + (y1 + y2 + y3) * attenuation * 0.3);
      }
      ctx.strokeStyle = 'rgba(180, 20, 30, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // secondary wave
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      for (let x = 0; x < width; x++) {
        const y1 = Math.sin((x * 0.003) - t * 0.4) * 60;
        const y2 = Math.sin((x * 0.004) + t * 0.6) * 30;
        const d = Math.abs(x - width / 2) / (width / 2);
        const attenuation = Math.max(0, 1 - Math.pow(d, 2));
        ctx.lineTo(x, centerY + (y1 + y2) * attenuation * 0.2);
      }
      ctx.strokeStyle = 'rgba(180, 20, 30, 0.08)';
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    const tick = () => {
      paint(time);
      time += 0.02;
      rafId = requestAnimationFrame(tick);
    };

    const start = () => {
      resize();
      cancelAnimationFrame(rafId);
      if (mql.matches) {
        // Reduced motion: paint a single static frame, no animation.
        paint(0);
      } else {
        tick();
      }
    };

    window.addEventListener('resize', start);
    mql.addEventListener?.('change', start);
    start();

    return () => {
      window.removeEventListener('resize', start);
      mql.removeEventListener?.('change', start);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none opacity-50 z-0"
      aria-hidden="true"
    />
  );
}
