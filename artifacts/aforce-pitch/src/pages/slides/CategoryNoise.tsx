import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

// The noisy category, made literal — the competitor product wall.
// Ordered so the two green cans (Prime, Monster) never sit adjacent.
// Positioned absolutely (left/bottom) so every can paints — a flex row with
// negative margins silently dropped the final child.
const COMPETITORS = [
  { s: "comp-redbull", rot: -5, h: "40vh", left: "1vw" },
  { s: "comp-prime", rot: 4, h: "43vh", left: "7.5vw" },
  { s: "comp-ghost", rot: -3, h: "42vh", left: "15vw" },
  { s: "comp-celsius", rot: 5, h: "40vh", left: "22.5vw" },
  { s: "comp-monster", rot: -4, h: "43vh", left: "29vw" },
  { s: "comp-gatorade", rot: 3, h: "41vh", left: "31.5vw" },
  { s: "comp-bodyarmor", rot: -4, h: "39vh", left: "40vw" },
  { s: "comp-powerade", rot: 4, h: "40vh", left: "46vw" },
];

type Frag = { t: string; top: string; left: string; size: string; rot: number; o: number };

// Fragmented marketing shrapnel.
const FRAGMENTS: Frag[] = [
  { t: "ZERO SUGAR", top: "37%", left: "16%", size: "1.2vw", rot: -6, o: 0.2 },
  { t: "+200MG", top: "55%", left: "10%", size: "1vw", rot: 7, o: 0.18 },
  { t: "ENERGY", top: "70%", left: "29%", size: "1.3vw", rot: -10, o: 0.16 },
  { t: "NEW", top: "26%", left: "8%", size: "1.1vw", rot: 4, o: 0.2 },
  { t: "BUY NOW", top: "83%", left: "15%", size: "0.95vw", rot: -8, o: 0.16 },
  { t: "CLEAN ENERGY", top: "48%", left: "27%", size: "0.9vw", rot: 12, o: 0.13 },
];

type Dot = { top: string; left: string; s: string; o: number; red?: boolean };

// Notification-style pings — the constant noise of the category.
const DOTS: Dot[] = [
  { top: "20%", left: "31%", s: "0.7vw", o: 0.6, red: true },
  { top: "33%", left: "12%", s: "0.5vw", o: 0.25 },
  { top: "46%", left: "33%", s: "0.45vw", o: 0.22 },
  { top: "58%", left: "6%", s: "0.6vw", o: 0.55, red: true },
  { top: "72%", left: "20%", s: "0.45vw", o: 0.22 },
  { top: "40%", left: "44%", s: "0.4vw", o: 0.2 },
  { top: "78%", left: "38%", s: "0.55vw", o: 0.5, red: true },
  { top: "14%", left: "40%", s: "0.4vw", o: 0.18 },
];

export default function CategoryNoise() {
  const reduce = useReducedMotion();
  const base = import.meta.env.BASE_URL;
  const can = (s: string) => `${base}images/products/${s}.png`;

  // The category noise — scoped to this slide only: it starts when the slide
  // mounts and stops the moment we navigate away. The label tracks the audio
  // element's real play/pause state, so it stays honest even when the browser
  // blocks autoplay-with-sound until the first user gesture.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  // Tears down the autoplay-unlock fallback. Called once the audio starts (so
  // it's no longer needed) or the moment the user takes explicit control via
  // the toggle (so a later stray gesture can't restart what they just muted).
  const disarmRef = useRef<(() => void) | null>(null);
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => {
    const audio = new Audio(`${base}audio/category-noise.mp3`);
    audio.loop = true;
    audio.volume = 1;
    audioRef.current = audio;

    const onPlay = () => {
      setSoundOn(true);
      // Playback is unlocked; the gesture fallback has done its job.
      disarmRef.current?.();
    };
    const onPause = () => setSoundOn(false);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    // Autoplay-block fallback: unlock on the first page gesture. We ignore
    // gestures on the toggle button itself — its own onClick manages playback,
    // so handling it here too would double-act on a single click.
    const unlock = (e: Event) => {
      if (btnRef.current && e.target instanceof Node && btnRef.current.contains(e.target)) {
        return;
      }
      audio.play().catch(() => {});
      disarmRef.current?.();
    };
    const disarm = () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      disarmRef.current = null;
    };
    disarmRef.current = disarm;
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    // Try to start immediately. In normal deck use the slide is reached via a
    // key/click, so the page already has user activation and this succeeds.
    audio.play().catch(() => {});

    return () => {
      disarm();
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, [base]);

  // Intent-driven: act on the audio element's actual state, never stale React
  // state. The play/pause listeners above keep `soundOn` in sync. Explicit use
  // disarms the autoplay-unlock fallback so it can't fight the user's choice.
  const toggleSound = () => {
    disarmRef.current?.();
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  };

  return (
    <SlideFrame slide={7}>
      <div className="absolute inset-0 overflow-hidden">
        {/* LEFT — the chaos */}
        <div className="absolute inset-y-0 left-0 w-[60%] overflow-hidden">
          {FRAGMENTS.map((f, i) => (
            <motion.div
              key={`f-${f.t}-${i}`}
              aria-hidden
              className="absolute font-display uppercase tracking-[0.1em] font-bold text-text whitespace-nowrap select-none"
              style={{ top: f.top, left: f.left, fontSize: f.size, transform: `rotate(${f.rot}deg)` }}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: f.o }}
              transition={reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.4 + i * 0.06 }}
            >
              {f.t}
            </motion.div>
          ))}

          {DOTS.map((d, i) => (
            <motion.span
              key={`d-${i}`}
              aria-hidden
              className={`absolute rounded-full ${d.red ? "bg-red" : "bg-text"}`}
              style={{ top: d.top, left: d.left, width: d.s, height: d.s }}
              initial={reduce ? false : { opacity: 0, scale: 0 }}
              animate={
                reduce
                  ? { opacity: d.o }
                  : d.red
                    ? { opacity: [d.o, 1, d.o], scale: [1, 1.45, 1] }
                    : { opacity: d.o, scale: 1 }
              }
              transition={
                reduce
                  ? undefined
                  : d.red
                    ? { duration: 1.8, ease: "easeInOut", repeat: Infinity, delay: i * 0.3 }
                    : { duration: 0.4, ease: EASE, delay: 0.5 + i * 0.05 }
              }
            />
          ))}

          {/* the noise dissolves into the paper at the top and bottom edges —
              composed, never hard-cut at the frame */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[16%]"
            style={{
              background:
                "linear-gradient(to bottom, rgba(239,236,230,0.96) 0%, rgba(239,236,230,0) 100%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[20%]"
            style={{
              background:
                "linear-gradient(to top, rgba(239,236,230,0.96) 0%, rgba(239,236,230,0) 100%)",
            }}
          />
        </div>

        {/* the category, made literal — the competitor product wall, crowding the noise side */}
        <div className="absolute bottom-[6vh] left-[2vw] right-0 h-[46vh] z-[12]">
          {COMPETITORS.map((c, i) => (
            <motion.img
              key={c.s}
              src={can(c.s)}
              alt=""
              aria-hidden
              loading="eager"
              decoding="sync"
              className="absolute bottom-0 w-auto object-contain drop-shadow-[0_2vh_3vh_rgba(0,0,0,0.34)]"
              style={{ height: c.h, left: c.left, zIndex: i, transformOrigin: "bottom center" }}
              initial={reduce ? false : { opacity: 0, y: 26, rotate: c.rot, scale: 0.94 }}
              animate={
                reduce
                  ? { opacity: 1, rotate: c.rot }
                  : { opacity: 1, y: [0, i % 2 ? 6 : -6, 0], rotate: c.rot, scale: 1 }
              }
              transition={
                reduce
                  ? undefined
                  : {
                      opacity: { duration: 0.6, ease: EASE, delay: 0.4 + i * 0.12 },
                      rotate: { duration: 0.6, ease: EASE, delay: 0.4 + i * 0.12 },
                      scale: { duration: 0.6, ease: EASE, delay: 0.4 + i * 0.12 },
                      y: {
                        duration: 5 + i,
                        ease: "easeInOut",
                        repeat: Infinity,
                        delay: 1 + i * 0.3,
                      },
                    }
              }
            />
          ))}
        </div>

        {/* paper wash — clears the calm side and dissolves the noise into it */}
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 w-[55%] pointer-events-none"
          style={{
            background:
              "linear-gradient(270deg, rgba(239,236,230,0.97) 0%, rgba(239,236,230,0.93) 42%, rgba(239,236,230,0) 100%)",
          }}
        />

        {/* the divide — the line where the shouting stops */}
        <div aria-hidden className="absolute top-[22vh] bottom-[16vh] left-[60%] w-px bg-text/15" />

        {/* HEADER — crisp, riding above the noise on a soft paper halo */}
        <div className="absolute top-[15vh] left-[5vw] z-20 max-w-[44vw]">
          <div
            aria-hidden
            className="absolute -inset-x-[5vw] -inset-y-[5vh] -z-10"
            style={{
              background:
                "radial-gradient(72% 70% at 26% 46%, rgba(239,236,230,0.98) 0%, rgba(239,236,230,0.86) 34%, rgba(239,236,230,0) 100%)",
            }}
          />
          <motion.div
            className="mb-[3.5vh]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
          >
            <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
              The Problem
            </span>
          </motion.div>

          <motion.h1
            className="font-display font-light tracking-[-0.025em] text-[5.6vw] leading-[1.02] text-text"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
          >
            <div>The category</div>
            <div>
              is <span className="text-red font-normal">noise.</span>
            </div>
          </motion.h1>

          <motion.p
            className="mt-[3.2vh] font-body text-[1vw] leading-[1.5] text-text/60 max-w-[24vw]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.18 }}
          >
            Every brand competes for attention. Few compete for composure.
          </motion.p>
        </div>

        {/* RIGHT — the stillness, anchored by the real AForce mark */}
        <div className="absolute inset-y-0 right-0 z-10 flex w-[40%] flex-col items-center justify-center px-[3vw] text-center">
          {/* spotlight that lifts the mark off the page */}
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[34vw] h-[34vw] pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at center, rgba(239,236,230,0.95) 0%, rgba(239,236,230,0.6) 38%, rgba(239,236,230,0) 70%)",
            }}
          />

          <motion.span
            aria-hidden
            className="relative block rounded-full bg-red"
            style={{ width: "0.85vw", height: "0.85vw" }}
            initial={reduce ? false : { opacity: 0, scale: 0 }}
            animate={
              reduce ? { opacity: 1 } : { opacity: [0.5, 1, 0.5], scale: [1, 1.35, 1] }
            }
            transition={
              reduce
                ? undefined
                : { duration: 2.4, ease: "easeInOut", repeat: Infinity, delay: 0.6 }
            }
          />

          <motion.div
            className="relative mt-[3.6vh] h-px bg-red"
            initial={reduce ? false : { width: 0, opacity: 0 }}
            animate={{ width: "5vw", opacity: 1 }}
            transition={reduce ? undefined : { duration: 0.7, ease: EASE, delay: 0.5 }}
          />

          <motion.div
            className="relative mt-[3.6vh] font-display uppercase tracking-[0.28em] text-[2.4vw] leading-[1.35] text-text font-semibold drop-shadow-[0_0.4vw_1.4vw_rgba(228,30,43,0.12)]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.7, ease: EASE, delay: 0.7 }}
          >
            Composure <span className="text-red">before</span> execution.
          </motion.div>
        </div>

        {/* sound toggle — the category noise plays only on this slide */}
        <motion.button
          ref={btnRef}
          type="button"
          onClick={toggleSound}
          aria-label={soundOn ? "Mute category noise" : "Play category noise"}
          aria-pressed={soundOn}
          className="absolute bottom-[10vh] left-[5vw] z-30 flex items-center gap-[0.6vw] rounded-full border border-text/20 bg-[#efece6]/70 px-[1vw] py-[0.7vh] backdrop-blur-sm transition-colors hover:border-red/60"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.7 }}
        >
          <span
            aria-hidden
            className={`block h-[0.55vw] w-[0.55vw] rounded-full ${soundOn ? "bg-red" : "bg-text/30"}`}
          />
          <span className="font-display uppercase tracking-[0.28em] text-[0.6vw] text-text font-semibold">
            {soundOn ? "Sound On" : "Tap for sound"}
          </span>
        </motion.button>
      </div>
    </SlideFrame>
  );
}
