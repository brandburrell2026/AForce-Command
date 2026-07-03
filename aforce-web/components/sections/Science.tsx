"use client";

import { motion, useReducedMotion } from "framer-motion";
import Reveal from "../Reveal";

const MINERALS = [
  { label: "Magnesium", sym: "Mg", angle: 0 },
  { label: "Potassium", sym: "K", angle: 60 },
  { label: "Calcium", sym: "Ca", angle: 120 },
  { label: "Sodium", sym: "Na", angle: 180 },
  { label: "Sea Moss", sym: "Sm", angle: 240 },
  { label: "Chlorella", sym: "Cl", angle: 300 },
];

const PILLARS = [
  { k: "Alkaline", v: "pH 8.8" },
  { k: "Minerals", v: "Plant-Based" },
  { k: "Function", v: "Recovery" },
  { k: "Function", v: "Hydration" },
  { k: "Function", v: "Performance" },
];

export default function Science() {
  const reduce = useReducedMotion();

  return (
    <section
      id="science"
      className="relative border-t border-white/[0.06] px-6 py-28 sm:px-10 lg:px-16 lg:py-40"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2">
        <div>
          <Reveal>
            <p className="eyebrow text-signal">The Science</p>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 className="mt-6 font-display text-4xl leading-[1.02] tracking-[-0.02em] text-bone sm:text-6xl">
              Balanced at
              <br />
              <span className="chrome-text">pH 8.8.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.12} variant="fade">
            <p className="mt-8 max-w-md text-lg leading-relaxed text-bone/60">
              Alkaline water carrying plant-derived minerals and electrolytes.
              Formulated to support recovery, hydration, and sustained
              performance — without sugar, without the crash.
            </p>
          </Reveal>

          <div className="mt-12 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3">
            {PILLARS.map((p, i) => (
              <Reveal key={p.v} delay={i * 0.06} variant="fade">
                <div className="border-t border-white/[0.08] pt-4">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone/35">
                    {p.k}
                  </div>
                  <div className="mt-1 font-display text-lg text-bone">
                    {p.v}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Mineral orbit visualization */}
        <Reveal variant="fade" className="flex justify-center">
          <div className="relative aspect-square w-full max-w-md">
            <svg viewBox="0 0 400 400" className="h-full w-full">
              <defs>
                <radialGradient id="core" cx="50%" cy="45%" r="60%">
                  <stop offset="0%" stopColor="#f5f0e8" stopOpacity="0.9" />
                  <stop offset="45%" stopColor="#cfcfd6" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#0d0d0d" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f5f0e8" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#f5f0e8" stopOpacity="0.03" />
                </linearGradient>
              </defs>

              {/* orbit rings */}
              {[150, 120, 90].map((r) => (
                <circle
                  key={r}
                  cx="200"
                  cy="200"
                  r={r}
                  fill="none"
                  stroke="url(#ring)"
                  strokeWidth="1"
                />
              ))}

              {/* core */}
              <circle cx="200" cy="200" r="86" fill="url(#core)" />
              <text
                x="200"
                y="196"
                textAnchor="middle"
                className="fill-canvas font-display"
                style={{ fontSize: "34px", fontWeight: 700 }}
              >
                8.8
              </text>
              <text
                x="200"
                y="220"
                textAnchor="middle"
                className="fill-canvas/70"
                style={{ fontSize: "10px", letterSpacing: "3px" }}
              >
                pH
              </text>
            </svg>

            {/* orbiting mineral nodes */}
            <motion.div
              className="absolute inset-0"
              animate={reduce ? undefined : { rotate: 360 }}
              transition={{ duration: 44, ease: "linear", repeat: Infinity }}
            >
              {MINERALS.map((m) => {
                const rad = (m.angle * Math.PI) / 180;
                const R = 37.5; // % radius
                // Fixed precision so SSR and client strings match exactly.
                const left = (50 + R * Math.cos(rad)).toFixed(3);
                const top = (50 + R * Math.sin(rad)).toFixed(3);
                return (
                  <motion.div
                    key={m.sym}
                    className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.14] bg-elevated/80 backdrop-blur"
                    style={{ left: `${left}%`, top: `${top}%` }}
                    animate={reduce ? undefined : { rotate: -360 }}
                    transition={{
                      duration: 44,
                      ease: "linear",
                      repeat: Infinity,
                    }}
                  >
                    <span className="font-mono text-xs text-bone/80">
                      {m.sym}
                    </span>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
