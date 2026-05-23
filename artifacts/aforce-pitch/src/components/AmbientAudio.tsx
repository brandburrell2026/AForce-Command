import { useEffect, useRef } from "react";

export default function AmbientAudio({
  enabled,
  volume = 0.22,
  src,
}: {
  enabled: boolean;
  volume?: number;
  src?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      const base = import.meta.env.BASE_URL;
      const a = new Audio(src ?? `${base}audio/cinematic-bed.mp3`);
      a.loop = true;
      a.preload = "auto";
      a.volume = 0;
      audioRef.current = a;
    }
    const a = audioRef.current;

    const fadeTo = (target: number, ms: number) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const start = performance.now();
      const from = a.volume;
      const step = (t: number) => {
        const p = Math.min(1, (t - start) / ms);
        a.volume = from + (target - from) * p;
        if (p < 1) rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    };

    if (enabled) {
      const p = a.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          // Autoplay blocked — will start on next user gesture via PresentationHUD toggle.
        });
      }
      fadeTo(volume, 2500);
    } else {
      fadeTo(0, 600);
      const id = window.setTimeout(() => {
        try {
          a.pause();
        } catch {
          // ignore
        }
      }, 700);
      return () => window.clearTimeout(id);
    }
  }, [enabled, volume, src]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const a = audioRef.current;
      if (a) {
        try {
          a.pause();
          a.src = "";
        } catch {
          // ignore
        }
      }
      audioRef.current = null;
    };
  }, []);

  return null;
}
