import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";
import { FLORIDA_PATH } from "./floridaPath";

const EASE = [0.16, 1, 0.3, 1] as const;

// Miami / Brickell in the Florida outline's coordinate system (viewBox 0 0 73 80).
const MIAMI = { x: 60.4, y: 56.2 };

export default function ProofEngine() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={10}>
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
            <svg
              viewBox="0 4 70 64"
              className="h-full w-full overflow-visible"
              role="img"
              aria-label="Map of Florida with Miami and Brickell highlighted"
            >
              {/* Florida landmass */}
              <motion.path
                d={FLORIDA_PATH}
                fill="#1a1815"
                fillOpacity={0.07}
                stroke="#1a1815"
                strokeOpacity={0.32}
                strokeWidth={0.45}
                strokeLinejoin="round"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={reduce ? undefined : { duration: 0.9, ease: EASE, delay: 0.35 }}
              />

              {/* pulsing halo at Miami / Brickell */}
              {!reduce && (
                <motion.circle
                  cx={MIAMI.x}
                  cy={MIAMI.y}
                  fill="#e41e2b"
                  fillOpacity={0.22}
                  initial={{ r: 2.3, opacity: 0.5 }}
                  animate={{ r: [2.3, 7.5, 2.3], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 3, ease: "easeInOut", repeat: Infinity, delay: 1.1 }}
                />
              )}

              {/* the marker — always solid red, just fades in */}
              <motion.circle
                cx={MIAMI.x}
                cy={MIAMI.y}
                r={2.4}
                fill="#e41e2b"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.8 }}
              />
              <circle cx={MIAMI.x} cy={MIAMI.y} r={0.9} fill="#f4f1ea" />
            </svg>

            {/* map caption */}
            <motion.div
              className="absolute left-1/2 top-full mt-[1.8vh] -translate-x-1/2 text-center"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.9 }}
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
