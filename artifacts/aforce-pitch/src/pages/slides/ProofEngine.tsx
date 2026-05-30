import { motion, useReducedMotion } from "framer-motion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

const PROOF = [
  {
    v: "Year-round",
    k: "Climate demand",
    d: "A subtropical city keeps hydration top-of-mind every month — the need never pauses.",
  },
  {
    v: "High-density",
    k: "The right consumer",
    d: "Affluent, performance-obsessed people concentrated per square mile.",
  },
  {
    v: "One market",
    k: "Prove, then scale",
    d: "Lock habit and retention in a single metro before the engine goes national.",
    accent: true,
  },
];

// Phyllotaxis spiral: dense at the center, sparse at the edge — a literal
// picture of a concentrated proving ground. Inner points glow red.
const DOTS = Array.from({ length: 46 }, (_, i) => {
  const golden = 2.399963229728653;
  const t = i / 46;
  const radius = Math.sqrt(t) * 47; // 0 → 47 (% from center)
  const angle = i * golden;
  return {
    x: 50 + radius * Math.cos(angle),
    y: 50 + radius * Math.sin(angle),
    size: 0.5 + (1 - t) * 1.05,
    accent: radius < 17,
    t,
  };
});

const RINGS = [38, 66, 92]; // diameter as % of the square

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

          {/* proof rows */}
          <div className="mt-[5vh] flex flex-col">
            {PROOF.map((p, i) => (
              <motion.div
                key={p.k}
                className={`flex items-baseline gap-[2vw] py-[1.8vh] ${
                  p.accent ? "border-t-2 border-red/55" : "border-t border-text/15"
                }`}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.32 + i * 0.1 }
                }
              >
                <div
                  className={`font-display font-light tracking-[-0.01em] text-[2vw] leading-none w-[9vw] shrink-0 ${
                    p.accent ? "text-red" : "text-text"
                  }`}
                >
                  {p.v}
                </div>
                <div className="min-w-0">
                  <div className="font-display uppercase tracking-[0.22em] text-[0.66vw] text-text/45 font-semibold mb-[0.7vh]">
                    {p.k}
                  </div>
                  <div className="font-body text-[0.86vw] leading-[1.5] text-text/65">
                    {p.d}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* RIGHT — the concentration graphic */}
        <div className="w-[48%] flex items-center justify-center pr-[6vw] pl-[1vw]">
          <motion.div
            className="relative aspect-square w-[36vw] mb-[7vh]"
            initial={reduce ? false : { opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduce ? undefined : { duration: 0.8, ease: EASE, delay: 0.3 }}
          >
            {/* soft pulsing glow behind the core */}
            {!reduce && (
              <motion.div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red/30 blur-[2.4vw]"
                animate={{ opacity: [0.35, 0.8, 0.35], scale: [0.85, 1.08, 0.85] }}
                transition={{ duration: 4.5, ease: "easeInOut", repeat: Infinity, delay: 1 }}
              />
            )}

            {/* concentric rings */}
            {RINGS.map((d, i) => (
              <motion.div
                key={d}
                aria-hidden
                className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                  i === 0 ? "border-red/35" : "border-text/25"
                }`}
                style={{ width: `${d}%`, height: `${d}%` }}
                initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={
                  reduce ? undefined : { duration: 0.7, ease: EASE, delay: 0.3 + i * 0.1 }
                }
              />
            ))}

            {/* converging dots */}
            {DOTS.map((dot, i) => (
              <motion.span
                key={i}
                aria-hidden
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${
                  dot.accent ? "bg-red" : "bg-text/55"
                }`}
                style={{
                  left: `${dot.x}%`,
                  top: `${dot.y}%`,
                  width: `${dot.size}vw`,
                  height: `${dot.size}vw`,
                }}
                initial={reduce ? false : { opacity: 0, scale: 0 }}
                animate={{ opacity: dot.accent ? 1 : 0.85, scale: 1 }}
                transition={
                  reduce
                    ? undefined
                    : { duration: 0.45, ease: EASE, delay: 0.45 + dot.t * 0.6 }
                }
              />
            ))}

            {/* glowing core — the beachhead, marked red */}
            <motion.div
              className="absolute left-1/2 top-1/2 flex h-[17%] w-[17%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red shadow-[0_0_3vw_rgba(228,30,43,0.6)]"
              initial={reduce ? false : { opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={
                reduce
                  ? undefined
                  : { type: "spring", stiffness: 140, damping: 14, delay: 0.55 }
              }
            >
              <span className="h-[42%] w-[42%] rounded-full bg-bg shadow-[0_0_0.8vw_rgba(255,255,255,0.7)]" />
            </motion.div>

            {/* core label */}
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
