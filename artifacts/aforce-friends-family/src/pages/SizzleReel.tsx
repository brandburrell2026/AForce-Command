import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

import Wordmark from "@/components/Wordmark";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { SizzleAudio } from "@/lib/sizzleAudio";
import { slides } from "@/slideLoader";

const DURATION = 45; // seconds, total reel length

const FLASH_WORDS = ["PERFORM.", "DELIVER.", "SHOW UP.", "BE READY.", "DO IT AGAIN."];
const RITUAL = ["Pause.", "Hydrate.", "Lock in.", "Perform."];

type Brand = {
  label: string;
  x: number; // %
  y: number; // %
  rot: number; // deg
  scale: number;
  appear: number; // 0..1 progress at which it shows
};

// Deterministic competitor cluster — builds in density across Act 1.
const BRANDS: Brand[] = [
  { label: "MONSTER", x: 18, y: 26, rot: -8, scale: 1.5, appear: 0.04 },
  { label: "CELSIUS", x: 70, y: 20, rot: 6, scale: 1.3, appear: 0.1 },
  { label: "RED BULL", x: 44, y: 60, rot: -4, scale: 1.7, appear: 0.16 },
  { label: "PRIME", x: 24, y: 74, rot: 9, scale: 1.2, appear: 0.24 },
  { label: "GHOST", x: 80, y: 64, rot: -11, scale: 1.1, appear: 0.32 },
  { label: "LMNT", x: 58, y: 40, rot: 4, scale: 0.95, appear: 0.4 },
  { label: "CELSIUS", x: 8, y: 50, rot: 12, scale: 1.0, appear: 0.48 },
  { label: "MONSTER", x: 88, y: 38, rot: -6, scale: 0.9, appear: 0.54 },
  { label: "PRIME", x: 64, y: 82, rot: -9, scale: 1.0, appear: 0.6 },
  { label: "RED BULL", x: 12, y: 12, rot: 7, scale: 0.85, appear: 0.66 },
  { label: "GHOST", x: 38, y: 16, rot: -3, scale: 0.8, appear: 0.72 },
  { label: "LMNT", x: 84, y: 84, rot: 10, scale: 0.75, appear: 0.78 },
  { label: "MONSTER", x: 50, y: 92, rot: -7, scale: 0.7, appear: 0.84 },
  { label: "CELSIUS", x: 30, y: 44, rot: 5, scale: 0.65, appear: 0.9 },
];

// Scattered notification dots, also building over Act 1.
const DOTS = Array.from({ length: 26 }, (_, i) => ({
  x: (i * 71) % 100,
  y: (i * 137) % 100,
  appear: i / 26,
  red: i % 5 === 0,
}));

function firstSlidePath(): string {
  const pos = slides.length > 0 ? slides[0].position : 1;
  return `/slide${pos}`;
}

export default function SizzleReel() {
  const [, navigate] = useLocation();
  const reduce = useReducedMotion();

  const [started, setStarted] = useState(false);
  const [t, setT] = useState(0);

  const audioRef = useRef<SizzleAudio | null>(null);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  // DEV-only: ?seek=20 jumps the visual clock to inspect an act (no audio).
  const seek = useMemo(() => {
    if (!import.meta.env.DEV) return 0;
    const v = Number(new URLSearchParams(window.location.search).get("seek"));
    return Number.isFinite(v) && v > 0 ? v : 0;
  }, []);

  const goToDeck = useRef(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    audioRef.current?.stop();
    audioRef.current = null;
    navigate(firstSlidePath(), { replace: true });
  }).current;

  const begin = (withAudio: boolean) => {
    if (started) return;
    setStarted(true);
    if (withAudio && !reduce) {
      const audio = new SizzleAudio();
      audioRef.current = audio;
      void audio.start();
    }
    const startWall = performance.now() - seek * 1000;
    const tick = () => {
      const elapsed = (performance.now() - startWall) / 1000;
      setT(elapsed);
      if (elapsed >= DURATION) {
        goToDeck();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // Reduced motion: skip the cinematic reel entirely, straight to the deck.
  useEffect(() => {
    if (reduce) goToDeck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  // DEV seek auto-starts visuals so acts can be screenshotted.
  useEffect(() => {
    if (!reduce && seek > 0 && !started) begin(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seek]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioRef.current?.stop();
      audioRef.current = null;
    };
  }, []);

  // ---- Start gate -----------------------------------------------------------
  // Reduced motion redirects via the effect above — render nothing cinematic.
  if (reduce) {
    return <div className="fixed inset-0 z-50 bg-black" />;
  }

  if (!started) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black text-white select-none">
        <Wordmark className="h-[2.6vw]" />
        <button
          type="button"
          onClick={() => begin(true)}
          className="mt-[5vh] rounded-full border border-white/30 px-[2.4vw] py-[1.4vh] font-display uppercase tracking-[0.3em] text-[0.8vw] text-white/85 transition-colors hover:border-white/70 hover:text-white"
        >
          Press to begin
        </button>
        <button
          type="button"
          onClick={goToDeck}
          className="mt-[3vh] font-body uppercase tracking-[0.28em] text-[0.62vw] text-white/35 transition-colors hover:text-white/70"
        >
          Skip intro
        </button>
        <div className="mt-[6vh] font-body uppercase tracking-[0.28em] text-[0.55vw] text-white/25">
          Sound on · 45 seconds
        </div>
      </div>
    );
  }

  // ---- Derived timeline state ----------------------------------------------
  const inAct1 = t < 18;
  const noiseProg = Math.min(1, t / 18);

  // Flash word index — accelerates as Act 1 builds.
  const flashIndex = (() => {
    // cumulative schedule with shrinking durations
    let acc = 0;
    let i = 0;
    while (acc < 18) {
      const prog = acc / 18;
      const dur = Math.max(0.32, 1.1 - prog * 0.8);
      if (t >= acc && t < acc + dur) break;
      acc += dur;
      i++;
    }
    return i;
  })();
  // Fast flicker on the flash word.
  const flicker = 0.45 + 0.55 * Math.abs(Math.sin(t * 26));

  // Act 1 cut to black at 18 → 1s silence/black to 19.
  const act2Up = Math.max(0, Math.min(1, (t - 19) / 1.6)); // fade up from black
  const logoIn = Math.max(0, Math.min(1, (t - 20) / 1.2));
  const ritualVisible = RITUAL.map((_, i) => t >= 21.2 + i * 1.2);

  // Act 3
  const scoreFill = Math.max(0, Math.min(1, (t - 28) / 5));
  const scoreNum = Math.round(scoreFill * 79);
  const showScore = t >= 28 && t < 34;
  const showReadiness = t >= 35 && t < 39;
  const line1In = Math.max(0, Math.min(1, (t - 35) / 0.8));
  const line2In = Math.max(0, Math.min(1, (t - 35.9) / 0.8));
  const showFinal = t >= 39;
  const finalIn = Math.max(0, Math.min(1, (t - 39.2) / 1.2));
  const tagIn = Math.max(0, Math.min(1, (t - 42) / 1.2));
  const fadeOut = Math.max(0, Math.min(1, (t - 44.3) / 0.7));

  const R = 120;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black text-white select-none">
      {/* ============================ ACT 1 — THE NOISE ===================== */}
      {inAct1 && (
        <div className="absolute inset-0" style={{ opacity: 1 }}>
          {/* competitor cluster */}
          {BRANDS.map((b, i) => {
            const shown = noiseProg >= b.appear;
            if (!shown) return null;
            const drift = Math.sin(t * 1.3 + i) * 0.6;
            return (
              <div
                key={`${b.label}-${i}`}
                className="absolute font-display font-bold uppercase tracking-tight whitespace-nowrap"
                style={{
                  left: `${b.x}%`,
                  top: `${b.y}%`,
                  transform: `translate(-50%, -50%) rotate(${b.rot + drift}deg) scale(${b.scale})`,
                  fontSize: "3.4vw",
                  color: "#3a3a3a",
                  opacity: 0.35 + noiseProg * 0.4,
                }}
              >
                {b.label}
              </div>
            );
          })}

          {/* notification dots */}
          {DOTS.map((d, i) => {
            if (noiseProg < d.appear) return null;
            const blink = 0.3 + 0.7 * Math.abs(Math.sin(t * 8 + i));
            return (
              <span
                key={`dot-${i}`}
                className="absolute rounded-full"
                style={{
                  left: `${d.x}%`,
                  top: `${d.y}%`,
                  width: "0.6vw",
                  height: "0.6vw",
                  background: d.red ? "#C0392B" : "#666",
                  opacity: blink * (0.4 + noiseProg * 0.6),
                }}
              />
            );
          })}

          {/* fragmented static */}
          <svg className="absolute inset-0 h-full w-full" style={{ opacity: 0.04 + noiseProg * 0.12 }}>
            <filter id="sizzle-static">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
            </filter>
            <rect width="100%" height="100%" filter="url(#sizzle-static)" />
          </svg>

          {/* flashing command words */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="font-display font-bold uppercase tracking-tight text-white text-center"
              style={{ fontSize: "8vw", opacity: flicker, lineHeight: 1 }}
            >
              {FLASH_WORDS[flashIndex % FLASH_WORDS.length]}
            </div>
          </div>

          {/* intensifying red vignette toward the peak */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, rgba(192,57,43,0) 40%, rgba(192,57,43,0.28) 100%)",
              opacity: noiseProg,
            }}
          />
        </div>
      )}

      {/* ============================ ACT 2 — THE SHIFT ==================== */}
      {t >= 18 && t < 28 && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ opacity: act2Up }}
        >
          <div style={{ opacity: logoIn }}>
            <Wordmark className="h-[3.2vw]" />
          </div>
          <div className="mt-[6vh] flex flex-col items-center gap-[2.2vh]">
            {RITUAL.map((w, i) => (
              <div
                key={w}
                className="font-display font-light tracking-[-0.01em] text-white"
                style={{
                  fontSize: "2.6vw",
                  opacity: ritualVisible[i] ? 1 : 0,
                  transform: ritualVisible[i] ? "translateY(0)" : "translateY(10px)",
                  transition: "opacity 0.9s ease, transform 0.9s ease",
                }}
              >
                {w}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================ ACT 3 — THE LOCK IN ================== */}
      {showScore && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative flex items-center justify-center" style={{ width: "30vh", height: "30vh" }}>
            <svg viewBox="0 0 280 280" className="absolute inset-0 h-full w-full -rotate-90">
              <circle cx="140" cy="140" r={R} fill="none" stroke="#222" strokeWidth="6" />
              <circle
                cx="140"
                cy="140"
                r={R}
                fill="none"
                stroke="#C0392B"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - scoreFill)}
              />
            </svg>
            <div className="flex flex-col items-center">
              <div className="font-display font-light tabular-nums text-white" style={{ fontSize: "6vw", lineHeight: 1 }}>
                {scoreNum}
              </div>
              <div className="mt-[1vh] font-body uppercase tracking-[0.32em] text-white/45" style={{ fontSize: "0.7vw" }}>
                AForce OS
              </div>
            </div>
          </div>
        </div>
      )}

      {showReadiness && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[2vh]">
          <div className="font-display font-light text-white/60" style={{ fontSize: "3vw", opacity: line1In }}>
            This is not about energy.
          </div>
          <div className="font-display font-normal text-white" style={{ fontSize: "3.4vw", opacity: line2In }}>
            This is about readiness.
          </div>
        </div>
      )}

      {showFinal && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div style={{ opacity: finalIn }}>
            <Wordmark className="h-[4vw]" />
          </div>
          <div
            className="mt-[5vh] font-body uppercase tracking-[0.4em] text-white/70 text-center"
            style={{ fontSize: "0.85vw", opacity: tagIn }}
          >
            Performance begins before the moment.
          </div>
        </div>
      )}

      {/* final crossfade to the deck */}
      <div aria-hidden className="absolute inset-0 bg-black pointer-events-none" style={{ opacity: fadeOut }} />

      {/* persistent skip */}
      <button
        type="button"
        onClick={goToDeck}
        className="absolute bottom-[4vh] right-[4vw] z-10 font-body uppercase tracking-[0.28em] text-[0.62vw] text-white/35 transition-colors hover:text-white/80"
      >
        Skip →
      </button>
    </div>
  );
}
