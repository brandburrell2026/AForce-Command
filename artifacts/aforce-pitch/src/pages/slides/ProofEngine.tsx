import { useId } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";
import { FLORIDA_PATH } from "./floridaPath";

const EASE = [0.16, 1, 0.3, 1] as const;

// Miami / Brickell in the Florida outline's coordinate system (viewBox 0 0 73 80).
const MIAMI = { x: 60.4, y: 56.2 };

// Graticule lines that read as a "data set" laid over the state. Clipped to the
// landmass so they only texture the interior.
const GRID_V = [10, 18, 26, 34, 42, 50, 58, 66];
const GRID_H = [10, 18, 26, 34, 42, 50, 58, 66];

// A concentrated scatter of high-performance consumers across the SE coast —
// density that tightens toward Miami / Brickell.
const DENSITY: { x: number; y: number; r: number; o: number }[] = [
  { x: 58.6, y: 54.2, r: 0.5, o: 0.55 },
  { x: 59.3, y: 52.4, r: 0.36, o: 0.42 },
  { x: 61.0, y: 54.0, r: 0.42, o: 0.5 },
  { x: 57.6, y: 55.6, r: 0.32, o: 0.38 },
  { x: 62.0, y: 57.4, r: 0.46, o: 0.5 },
  { x: 60.0, y: 58.6, r: 0.3, o: 0.34 },
  { x: 58.0, y: 57.0, r: 0.34, o: 0.36 },
  { x: 56.4, y: 53.0, r: 0.3, o: 0.32 },
  { x: 55.2, y: 51.0, r: 0.28, o: 0.3 },
  { x: 62.6, y: 55.6, r: 0.3, o: 0.36 },
  { x: 59.6, y: 50.6, r: 0.3, o: 0.32 },
  { x: 57.0, y: 51.4, r: 0.26, o: 0.3 },
  { x: 61.6, y: 52.6, r: 0.3, o: 0.34 },
];

export default function ProofEngine() {
  const reduce = useReducedMotion();

  // Namespace SVG def ids so multiple mounts (e.g. an all-slides export view)
  // never collide on the same global id.
  const uid = useId().replace(/:/g, "");
  const CLIP = `${uid}-fl-clip`;
  const LAND = `${uid}-fl-land`;
  const HEAT = `${uid}-miami-heat`;
  const GLOW = `${uid}-fl-glow`;
  const LIFT = `${uid}-fl-lift`;

  return (
    <SlideFrame slide={13}>
      <div className="absolute inset-0 flex pt-[12vh] pb-[9vh]">
        {/* LEFT — argument */}
        <div className="w-[52%] flex flex-col justify-center px-[5vw]">
          <motion.div
            className="mb-[3.4vh]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
          >
            <span className="font-display uppercase tracking-[0.34em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
              The Proof Engine
            </span>
          </motion.div>

          <motion.h1
            className="font-display font-light tracking-[-0.025em] text-[4.6vw] leading-[1.0] text-text"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
          >
            <div>A concentrated</div>
            <div className="text-red font-normal">proving ground.</div>
          </motion.h1>

          <motion.p
            className="mt-[2.6vh] max-w-[33vw] font-body text-[1.05vw] leading-[1.55] text-text/65"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.18 }}
          >
            Miami and Brickell hold a dense population of high-performance
            consumers — the fastest place on the map to prove habit before we
            scale.
          </motion.p>

          {/* one dominant statement — the map does the rest */}
          <motion.p
            className="mt-[5vh] max-w-[30vw] font-display font-medium tracking-[-0.01em] text-[1.55vw] leading-[1.35] text-text"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.32 }}
          >
            Miami. Brickell. One market. One data set. One proof before the
            national stage.
          </motion.p>

          <motion.div
            className="mt-[3vh] flex items-center gap-[1.1vw] font-display uppercase tracking-[0.22em] text-[0.64vw] text-text/45 font-semibold"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.46 }}
          >
            <span>Year-round demand</span>
            <span className="text-text/20">|</span>
            <span>High-density target</span>
            <span className="text-text/20">|</span>
            <span>Prove then scale</span>
          </motion.div>
        </div>

        {/* RIGHT — the proving ground, on the map */}
        <div className="w-[48%] flex items-center justify-center pr-[6vw] pl-[1vw]">
          <motion.div
            className="relative aspect-square w-[34vw] mb-[7vh]"
            initial={reduce ? false : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduce ? undefined : { duration: 0.8, ease: EASE, delay: 0.3 }}
          >
            {/* ambient red bloom behind the southern tip — atmosphere */}
            <div
              aria-hidden
              className="absolute right-[6%] bottom-[14%] h-[42%] w-[42%] rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(228,30,43,0.22) 0%, rgba(228,30,43,0) 70%)",
                filter: "blur(6px)",
              }}
            />

            <svg
              viewBox="0 4 70 64"
              className="relative h-full w-full overflow-visible"
              role="img"
              aria-label="Map of Florida with Miami and Brickell highlighted as the concentrated proving ground"
            >
              <defs>
                <clipPath id={CLIP}>
                  <path d={FLORIDA_PATH} />
                </clipPath>

                {/* sculpted landmass — lit from the upper-left */}
                <radialGradient id={LAND} cx="38%" cy="18%" r="92%">
                  <stop offset="0%" stopColor="#2c2823" stopOpacity={0.18} />
                  <stop offset="55%" stopColor="#1a1815" stopOpacity={0.11} />
                  <stop offset="100%" stopColor="#1a1815" stopOpacity={0.06} />
                </radialGradient>

                {/* coastal heat hugging Miami / Brickell */}
                <radialGradient
                  id={HEAT}
                  cx={MIAMI.x}
                  cy={MIAMI.y}
                  r={16}
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor="#e41e2b" stopOpacity={0.5} />
                  <stop offset="32%" stopColor="#e41e2b" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#e41e2b" stopOpacity={0} />
                </radialGradient>

                {/* edge glow + elevation */}
                <filter id={GLOW} x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation={1.3} />
                </filter>
                <filter id={LIFT} x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow
                    dx="0"
                    dy="0.7"
                    stdDeviation="0.8"
                    floodColor="#1a1815"
                    floodOpacity="0.2"
                  />
                </filter>
              </defs>

              {/* soft red aura tracing the coastline */}
              <motion.path
                d={FLORIDA_PATH}
                fill="none"
                stroke="#e41e2b"
                strokeOpacity={0.22}
                strokeWidth={0.8}
                filter={`url(#${GLOW})`}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={reduce ? undefined : { duration: 1, ease: EASE, delay: 0.45 }}
              />

              {/* Florida landmass — gradient fill, fine stroke, lifted off the paper */}
              <motion.path
                d={FLORIDA_PATH}
                fill={`url(#${LAND})`}
                stroke="#1a1815"
                strokeOpacity={0.4}
                strokeWidth={0.4}
                strokeLinejoin="round"
                filter={`url(#${LIFT})`}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={reduce ? undefined : { duration: 0.9, ease: EASE, delay: 0.35 }}
              />

              {/* interior data texture — only inside the state */}
              <g clipPath={`url(#${CLIP})`}>
                {/* graticule */}
                <motion.g
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={reduce ? undefined : { duration: 0.8, ease: EASE, delay: 0.6 }}
                >
                  {GRID_V.map((x) => (
                    <line
                      key={`v${x}`}
                      x1={x}
                      y1={0}
                      x2={x}
                      y2={80}
                      stroke="#1a1815"
                      strokeOpacity={0.08}
                      strokeWidth={0.12}
                    />
                  ))}
                  {GRID_H.map((y) => (
                    <line
                      key={`h${y}`}
                      x1={0}
                      y1={y}
                      x2={73}
                      y2={y}
                      stroke="#1a1815"
                      strokeOpacity={0.08}
                      strokeWidth={0.12}
                    />
                  ))}
                </motion.g>

                {/* coastal heat */}
                <motion.rect
                  x={0}
                  y={0}
                  width={73}
                  height={80}
                  fill={`url(#${HEAT})`}
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={reduce ? undefined : { duration: 1, ease: EASE, delay: 0.7 }}
                />

                {/* density scatter */}
                {DENSITY.map((d, i) => (
                  <motion.circle
                    key={`d${i}`}
                    cx={d.x}
                    cy={d.y}
                    r={d.r}
                    fill="#e41e2b"
                    fillOpacity={d.o}
                    initial={reduce ? false : { opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={
                      reduce
                        ? undefined
                        : { duration: 0.5, ease: EASE, delay: 0.85 + i * 0.045 }
                    }
                    style={{ transformOrigin: `${d.x}px ${d.y}px` }}
                  />
                ))}
              </g>

              {/* radar pings emanating from Miami */}
              {!reduce &&
                [0, 1, 2].map((i) => (
                  <motion.circle
                    key={`ring${i}`}
                    cx={MIAMI.x}
                    cy={MIAMI.y}
                    fill="none"
                    stroke="#e41e2b"
                    strokeWidth={0.18}
                    initial={{ r: 1.5, opacity: 0.6 }}
                    animate={{ r: [1.5, 9], opacity: [0.6, 0] }}
                    transition={{
                      duration: 3.4,
                      ease: "easeOut",
                      repeat: Infinity,
                      delay: 1.1 + i * 0.95,
                    }}
                  />
                ))}

              {/* refined crosshair marker */}
              <motion.g
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={reduce ? undefined : { duration: 0.5, ease: EASE, delay: 1 }}
              >
                <line
                  x1={MIAMI.x - 3.4}
                  y1={MIAMI.y}
                  x2={MIAMI.x + 3.4}
                  y2={MIAMI.y}
                  stroke="#e41e2b"
                  strokeOpacity={0.45}
                  strokeWidth={0.16}
                />
                <line
                  x1={MIAMI.x}
                  y1={MIAMI.y - 3.4}
                  x2={MIAMI.x}
                  y2={MIAMI.y + 3.4}
                  stroke="#e41e2b"
                  strokeOpacity={0.45}
                  strokeWidth={0.16}
                />
                <circle
                  cx={MIAMI.x}
                  cy={MIAMI.y}
                  r={2.1}
                  fill="none"
                  stroke="#e41e2b"
                  strokeWidth={0.22}
                  strokeOpacity={0.7}
                />
                <circle cx={MIAMI.x} cy={MIAMI.y} r={1.35} fill="#e41e2b" />
                <circle cx={MIAMI.x} cy={MIAMI.y} r={0.55} fill="#f4f1ea" />
              </motion.g>
            </svg>

            {/* map caption */}
            <motion.div
              className="absolute left-1/2 top-full mt-[1.8vh] -translate-x-1/2 text-center"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 1.1 }}
            >
              <div className="font-display uppercase tracking-[0.28em] text-[0.78vw] text-red font-semibold whitespace-nowrap">
                Miami · Brickell
              </div>
              <div className="font-display uppercase tracking-[0.24em] text-[0.6vw] text-text/45 font-medium mt-[0.7vh] whitespace-nowrap">
                The beachhead
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </SlideFrame>
  );
}
