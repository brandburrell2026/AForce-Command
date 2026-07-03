"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import Monogram from "../Monogram";

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Cinematic drift: the stage sinks and dims slightly as you leave it.
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const overlayOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);

  const ease = [0.16, 1, 0.3, 1] as const;

  return (
    <section
      id="hero"
      ref={ref}
      className="relative flex min-h-dvh flex-col justify-end overflow-hidden"
    >
      {/* Cinematic stage — video slot with a layered fallback beneath */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={reduce ? undefined : { y, scale }}
      >
        {/* Fallback cinematic canvas (shows until hero.mp4 is dropped in) */}
        <div className="absolute inset-0 bg-canvas" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 50% -10%, rgba(193,40,27,0.20), transparent 55%), radial-gradient(90% 60% at 80% 20%, rgba(245,240,232,0.06), transparent 60%)",
          }}
        />
        {/* Brushed-light sweep */}
        <div
          className="absolute inset-0 opacity-[0.14] mix-blend-screen"
          style={{
            background:
              "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.5) 48%, transparent 62%)",
          }}
        />
        {/* Real film goes here — muted autoplay loop. Absent source → fallback shows. */}
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-70"
          autoPlay
          muted
          loop
          playsInline
          poster="/video/hero-poster.jpg"
        >
          <source src="/video/hero.mp4" type="video/mp4" />
        </video>
        {/* Legibility scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/40 to-canvas/70" />
      </motion.div>

      {/* Top hairline caption */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 top-24 flex justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, delay: 0.2 }}
      >
        <span className="eyebrow text-bone/40">Performance Readiness</span>
      </motion.div>

      {/* Manifesto */}
      <motion.div
        className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-16 sm:px-10 lg:px-16 lg:pb-24"
        style={reduce ? undefined : { opacity: overlayOpacity }}
      >
        <div className="max-w-4xl">
          <motion.p
            className="eyebrow text-signal"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5, ease }}
          >
            AForce
          </motion.p>

          <motion.h1
            className="mt-6 font-display text-[13vw] leading-[0.9] tracking-[-0.02em] text-bone sm:text-7xl lg:text-[6.5rem]"
            initial={{ opacity: 0, y: 40, filter: "blur(16px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1.3, delay: 0.7, ease }}
          >
            Performance Is
            <br />
            Non-Negotiable.
          </motion.h1>

          <motion.div
            className="mt-10 flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.1, delay: 1.05, ease }}
          >
            <p className="font-mono text-xs uppercase tracking-[0.32em] text-bone/60 sm:text-sm">
              Pause<span className="text-signal"> · </span>Hydrate
              <span className="text-signal"> · </span>Lock In
              <span className="text-signal"> · </span>Perform
            </p>

            <a
              href="#why"
              className="group inline-flex items-center gap-3 self-start font-mono text-xs uppercase tracking-[0.22em] text-bone sm:self-auto"
            >
              <span className="relative">
                Explore
                <span className="absolute -bottom-1 left-0 h-px w-full origin-left scale-x-100 bg-bone/40 transition-transform duration-500 group-hover:scale-x-0" />
                <span className="absolute -bottom-1 left-0 h-px w-full origin-right scale-x-0 bg-signal transition-transform delay-150 duration-500 group-hover:scale-x-100" />
              </span>
              <span aria-hidden className="transition-transform duration-500 group-hover:translate-y-1">
                ↓
              </span>
            </a>
          </motion.div>
        </div>
      </motion.div>

      {/* Corner marks */}
      <div className="pointer-events-none absolute right-6 top-24 z-10 sm:right-10">
        <Monogram className="text-lg text-bone/70" />
      </div>

      {/* Honest placeholder tag for the film slot */}
      <div className="pointer-events-none absolute bottom-6 left-6 z-10 sm:left-10">
        <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-bone/25">
          Film slot · public/video/hero.mp4
        </span>
      </div>
    </section>
  );
}
