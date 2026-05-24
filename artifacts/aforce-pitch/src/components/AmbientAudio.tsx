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
  const base = import.meta.env.BASE_URL;
  const resolvedSrc = src ?? `${base}audio/cinematic-bed.mp3`;

  const activeRef = useRef<HTMLAudioElement | null>(null);
  const incomingRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const currentSrcRef = useRef<string | null>(null);
  const enabledRef = useRef<boolean>(enabled);
  const targetVolumeRef = useRef<number>(volume);

  enabledRef.current = enabled;
  targetVolumeRef.current = volume;

  // Track-switch crossfade
  useEffect(() => {
    if (currentSrcRef.current === resolvedSrc) return;

    const next = new Audio(resolvedSrc);
    next.loop = true;
    next.preload = "auto";
    next.volume = 0;

    if (!activeRef.current) {
      activeRef.current = next;
      currentSrcRef.current = resolvedSrc;
      if (enabledRef.current) {
        tryPlayWithGestureFallback(next, targetVolumeRef.current, 2500);
      }
      return;
    }

    incomingRef.current = next;
    const previous = activeRef.current;
    currentSrcRef.current = resolvedSrc;

    if (enabledRef.current) {
      tryPlayWithGestureFallback(next, targetVolumeRef.current, 2200);
      fade(previous, 0, 2200, () => {
        try {
          previous.pause();
          previous.src = "";
        } catch {
          // ignore
        }
      });
    } else {
      next.volume = 0;
    }

    activeRef.current = next;
    incomingRef.current = null;
  }, [resolvedSrc]);

  // Enable/disable fade
  useEffect(() => {
    const a = activeRef.current;
    if (!a) return;
    if (enabled) {
      tryPlayWithGestureFallback(a, volume, 2200);
    } else {
      fade(a, 0, 600, () => {
        try {
          a.pause();
        } catch {
          // ignore
        }
      });
    }
  }, [enabled, volume]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      [activeRef.current, incomingRef.current].forEach((a) => {
        if (!a) return;
        try {
          a.pause();
          a.src = "";
        } catch {
          // ignore
        }
      });
      activeRef.current = null;
      incomingRef.current = null;
    };
  }, []);

  return null;
}

function tryPlayWithGestureFallback(
  el: HTMLAudioElement,
  target: number,
  ms: number,
) {
  const attempt = () => {
    const p = el.play();
    if (p && typeof p.then === "function") {
      p.then(() => fade(el, target, ms)).catch(() => {
        // Autoplay blocked — retry on the next user gesture.
        const onGesture = () => {
          window.removeEventListener("pointerdown", onGesture);
          window.removeEventListener("keydown", onGesture);
          window.removeEventListener("touchstart", onGesture);
          const p2 = el.play();
          if (p2 && typeof p2.then === "function") {
            p2.then(() => fade(el, target, ms)).catch(() => {});
          } else {
            fade(el, target, ms);
          }
        };
        window.addEventListener("pointerdown", onGesture, { once: true });
        window.addEventListener("keydown", onGesture, { once: true });
        window.addEventListener("touchstart", onGesture, { once: true });
      });
    } else {
      fade(el, target, ms);
    }
  };
  attempt();
}

const rafMap = new WeakMap<HTMLAudioElement, number>();

function fade(
  el: HTMLAudioElement,
  target: number,
  ms: number,
  onDone?: () => void,
) {
  const prev = rafMap.get(el);
  if (prev) cancelAnimationFrame(prev);
  const start = performance.now();
  const from = el.volume;
  const step = (t: number) => {
    const p = Math.min(1, (t - start) / ms);
    el.volume = Math.max(0, Math.min(1, from + (target - from) * p));
    if (p < 1) {
      rafMap.set(el, requestAnimationFrame(step));
    } else {
      rafMap.delete(el);
      onDone?.();
    }
  };
  rafMap.set(el, requestAnimationFrame(step));
}
