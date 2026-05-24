import { motion } from "framer-motion";
import SlideChrome from "@/components/SlideChrome";

const PHASES = [
  {
    n: "01",
    city: "Miami / Brickell",
    role: "Proof Engine",
    detail: "50–100 selected operators. Founder-led activation. Behavioral validation.",
    active: true,
  },
  {
    n: "02",
    city: "New York",
    role: "Behavioral Expansion",
    detail: "Finance density. Performance overlap. The ritual travels.",
    active: false,
  },
];

// Simplified US East Coast path — abstract, decorative, not survey-grade.
// Drawn within viewBox 100×100. Runs from Maine area down through FL.
const COAST_PATH =
  "M 86 4 L 84 9 L 81 13 L 78 16 L 76 19 L 75 22 L 74 25 L 73 28 L 71 32 L 69 36 L 67 40 L 65 44 L 62 49 L 59 54 L 55 59 L 51 64 L 47 69 L 43 73 L 40 77 L 37 81 L 34 84 L 32 87 L 30 89 L 28 91 L 27 93 L 26 95 L 26 96.5 L 27 97.5 L 29 97 L 31 95 L 33 92 L 35 88";

// Cities in same viewBox space.
const MIAMI = { x: 29, y: 89 };
const NYC = { x: 74, y: 22 };
// Quadratic curve control point pulled west (interior) to feel like a flight arc.
const ARC_CP = { x: 42, y: 50 };

export default function ProofModel() {
  return (
    <SlideChrome slide={22}>
      <div className="absolute inset-0 grid grid-cols-12 px-[8vw] pt-[12vh] pb-[10vh] gap-[3vw]">
        {/* LEFT RAIL */}
        <div className="col-span-5 flex flex-col">
          <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold">
            The Proof of Concept Model
          </div>

          <h2 className="font-display text-[4.2vw] leading-[0.92] tracking-tighter mt-[2vh]">
            Phase 1.
            <br />
            <span className="text-primary">Miami → NYC.</span>
          </h2>

          <div className="font-body text-[0.9vw] leading-[1.55] text-text/65 mt-[2.5vh] max-w-[26vw]">
            A concentrated proof engine.{" "}
            <span className="text-text/90">Not a launch.</span> The ritual is validated
            before it is scaled.
          </div>

          <div className="mt-[4vh] flex flex-col gap-[2.5vh]">
            {PHASES.map((p) => (
              <div
                key={p.n}
                className={`border-l-2 pl-[1.2vw] ${
                  p.active ? "border-primary" : "border-text/15"
                }`}
              >
                <div className="flex items-baseline gap-[0.8vw]">
                  <span
                    className={`font-body uppercase tracking-[0.32em] text-[0.7vw] font-semibold tabular-nums ${
                      p.active ? "text-primary/85" : "text-text/40"
                    }`}
                  >
                    Phase {p.n}
                  </span>
                  <span className="font-body uppercase tracking-[0.28em] text-[0.62vw] text-text/35 font-semibold">
                    · {p.role}
                  </span>
                </div>
                <div
                  className={`font-display text-[1.9vw] leading-[1.1] tracking-tight mt-[0.4vh] ${
                    p.active ? "text-text" : "text-text/55"
                  }`}
                >
                  {p.city}
                </div>
                <div className="font-body text-[0.8vw] leading-[1.5] text-text/55 mt-[0.6vh] max-w-[22vw]">
                  {p.detail}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto pt-[3vh] font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/35 font-semibold">
            Strategic · Focused · Intentional
          </div>
        </div>

        {/* RIGHT MAP */}
        <div className="col-span-7 relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              viewBox="0 0 100 100"
              className="w-full h-full max-h-[72vh]"
              preserveAspectRatio="xMidYMid meet"
              aria-label="Miami to New York rollout map"
            >
              <defs>
                <linearGradient id="route-grad" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--slide-primary)" stopOpacity="0.95" />
                  <stop offset="55%" stopColor="var(--slide-primary)" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="var(--slide-primary)" stopOpacity="0.25" />
                </linearGradient>
                <radialGradient id="origin-glow" cx="0.5" cy="0.5" r="0.5">
                  <stop offset="0%" stopColor="var(--slide-primary)" stopOpacity="0.55" />
                  <stop offset="60%" stopColor="var(--slide-primary)" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="var(--slide-primary)" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="target-glow" cx="0.5" cy="0.5" r="0.5">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.35" />
                  <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                </radialGradient>
                <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="0.6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Latitude reference rules */}
              {[20, 35, 50, 65, 80].map((y) => (
                <line
                  key={y}
                  x1="0"
                  y1={y}
                  x2="100"
                  y2={y}
                  stroke="currentColor"
                  strokeWidth="0.06"
                  className="text-text/15"
                />
              ))}

              {/* Coastline outline */}
              <path
                d={COAST_PATH}
                fill="none"
                stroke="currentColor"
                strokeWidth="0.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-text/30"
              />

              {/* Origin glow */}
              <circle cx={MIAMI.x} cy={MIAMI.y} r="14" fill="url(#origin-glow)" />
              {/* Target glow */}
              <circle cx={NYC.x} cy={NYC.y} r="10" fill="url(#target-glow)" />

              {/* Route — animated dashed arc */}
              <motion.path
                d={`M ${MIAMI.x} ${MIAMI.y} Q ${ARC_CP.x} ${ARC_CP.y} ${NYC.x} ${NYC.y}`}
                fill="none"
                stroke="url(#route-grad)"
                strokeWidth="0.6"
                strokeLinecap="round"
                strokeDasharray="1.6 1.4"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 2.2, ease: [0.22, 0.61, 0.36, 1], delay: 0.4 }}
                filter="url(#soft-glow)"
              />

              {/* Origin point — Miami */}
              <circle
                cx={MIAMI.x}
                cy={MIAMI.y}
                r="1.3"
                fill="var(--slide-primary)"
                filter="url(#soft-glow)"
              />
              <motion.circle
                cx={MIAMI.x}
                cy={MIAMI.y}
                r="2.4"
                fill="none"
                stroke="var(--slide-primary)"
                strokeWidth="0.18"
                initial={{ scale: 1, opacity: 0.7 }}
                animate={{ scale: [1, 2.2, 1], opacity: [0.7, 0, 0.7] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeOut" }}
                style={{ transformOrigin: `${MIAMI.x}px ${MIAMI.y}px` }}
              />

              {/* Target point — NYC (hollow, awaiting) */}
              <circle
                cx={NYC.x}
                cy={NYC.y}
                r="1.1"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.22"
                className="text-text/85"
              />
              <circle
                cx={NYC.x}
                cy={NYC.y}
                r="0.4"
                fill="currentColor"
                className="text-text/85"
              />

              {/* City labels */}
              <g>
                <text
                  x={MIAMI.x + 3}
                  y={MIAMI.y + 0.8}
                  fill="currentColor"
                  fontSize="2.2"
                  fontFamily="Manrope, sans-serif"
                  fontWeight="700"
                  letterSpacing="0.4"
                  className="text-text"
                  style={{ textTransform: "uppercase" }}
                >
                  MIAMI
                </text>
                <text
                  x={MIAMI.x + 3}
                  y={MIAMI.y + 4}
                  fill="var(--slide-primary)"
                  fontSize="1.4"
                  fontFamily="Manrope, sans-serif"
                  fontWeight="600"
                  letterSpacing="0.6"
                  style={{ textTransform: "uppercase" }}
                >
                  PHASE 01 · ACTIVE
                </text>
              </g>
              <g>
                <text
                  x={NYC.x - 1}
                  y={NYC.y - 3.4}
                  fill="currentColor"
                  fontSize="2.2"
                  fontFamily="Manrope, sans-serif"
                  fontWeight="700"
                  letterSpacing="0.4"
                  textAnchor="end"
                  className="text-text"
                  style={{ textTransform: "uppercase" }}
                >
                  NEW YORK
                </text>
                <text
                  x={NYC.x - 1}
                  y={NYC.y - 0.6}
                  fill="currentColor"
                  fontSize="1.4"
                  fontFamily="Manrope, sans-serif"
                  fontWeight="600"
                  letterSpacing="0.6"
                  textAnchor="end"
                  className="text-text/55"
                  style={{ textTransform: "uppercase" }}
                >
                  PHASE 02 · NEXT
                </text>
              </g>
            </svg>
          </div>

          {/* Map footer */}
          <div className="absolute bottom-0 left-0 right-0 flex items-baseline justify-between gap-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.62vw] text-text/30 font-semibold">
              East Corridor · Proof Phase
            </div>
            <div className="font-display text-[1.1vw] leading-[1.2] tracking-tight text-text/75 text-right max-w-[26vw]">
              The ritual is validated in Miami. <br className="hidden md:block" />
              <span className="text-primary">Then it travels.</span>
            </div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
