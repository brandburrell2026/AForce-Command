import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

type Brand = {
  t: string;
  top: string;
  left: string;
  size: string;
  rot: number;
  o: number;
};

// The category, shouting over itself — loud names at aggressive sizes,
// smaller echoes fading into the din. Pure noise.
const BRANDS: Brand[] = [
  { t: "MONSTER", top: "34%", left: "2%", size: "7.6vw", rot: -8, o: 0.17 },
  { t: "CELSIUS", top: "59%", left: "15%", size: "5.6vw", rot: 6, o: 0.14 },
  { t: "PRIME", top: "73%", left: "1%", size: "6.6vw", rot: -4, o: 0.11 },
  { t: "RED BULL", top: "47%", left: "29%", size: "4.4vw", rot: 11, o: 0.1 },
  { t: "GHOST", top: "83%", left: "29%", size: "4vw", rot: -13, o: 0.08 },
  { t: "LMNT", top: "31%", left: "40%", size: "3.6vw", rot: 15, o: 0.07 },
  { t: "CELSIUS", top: "20%", left: "27%", size: "3vw", rot: -18, o: 0.06 },
  { t: "PRIME", top: "63%", left: "42%", size: "2.8vw", rot: 20, o: 0.05 },
  { t: "MONSTER", top: "91%", left: "11%", size: "2.6vw", rot: 9, o: 0.05 },
];

type Frag = {
  t: string;
  top: string;
  left: string;
  size: string;
  rot: number;
  o: number;
};

// Fragmented marketing shrapnel.
const FRAGMENTS: Frag[] = [
  { t: "ZERO SUGAR", top: "51%", left: "4%", size: "1.3vw", rot: -6, o: 0.14 },
  { t: "+200MG", top: "69%", left: "22%", size: "1.1vw", rot: 7, o: 0.12 },
  { t: "ENERGY", top: "41%", left: "19%", size: "1.5vw", rot: -10, o: 0.11 },
  { t: "NEW", top: "27%", left: "12%", size: "1.2vw", rot: 4, o: 0.13 },
  { t: "BUY NOW", top: "79%", left: "44%", size: "1vw", rot: -8, o: 0.1 },
  { t: "100% CLEAN", top: "89%", left: "38%", size: "0.95vw", rot: 12, o: 0.09 },
];

type Dot = { top: string; left: string; s: string; o: number; red?: boolean };

// Notification-style dots — the constant ping of the category.
const DOTS: Dot[] = [
  { top: "30%", left: "34%", s: "0.65vw", o: 0.5, red: true },
  { top: "55%", left: "8%", s: "0.5vw", o: 0.18 },
  { top: "44%", left: "26%", s: "0.4vw", o: 0.16 },
  { top: "70%", left: "16%", s: "0.55vw", o: 0.42, red: true },
  { top: "84%", left: "23%", s: "0.45vw", o: 0.16 },
  { top: "37%", left: "44%", s: "0.4vw", o: 0.14 },
  { top: "63%", left: "36%", s: "0.5vw", o: 0.46, red: true },
];

export default function CategoryNoise() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={7}>
      <div className="absolute inset-0 overflow-hidden">
        {/* LEFT — the chaos */}
        <div className="absolute inset-y-0 left-0 w-[56%] overflow-hidden">
          {BRANDS.map((b, i) => (
            <motion.div
              key={`${b.t}-${i}`}
              aria-hidden
              className="absolute font-display font-extrabold tracking-tight text-text whitespace-nowrap select-none"
              style={{ top: b.top, left: b.left, fontSize: b.size }}
              initial={reduce ? false : { opacity: 0, scale: 0.9, rotate: b.rot }}
              animate={{ opacity: b.o, scale: 1, rotate: b.rot }}
              transition={
                reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.05 + i * 0.05 }
              }
            >
              {b.t}
            </motion.div>
          ))}

          {FRAGMENTS.map((f, i) => (
            <motion.div
              key={`f-${f.t}-${i}`}
              aria-hidden
              className="absolute font-display uppercase tracking-[0.1em] font-bold text-text whitespace-nowrap select-none"
              style={{ top: f.top, left: f.left, fontSize: f.size }}
              initial={reduce ? false : { opacity: 0, rotate: f.rot }}
              animate={{ opacity: f.o, rotate: f.rot }}
              transition={
                reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.4 + i * 0.06 }
              }
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
              animate={{ opacity: d.o, scale: 1 }}
              transition={
                reduce ? undefined : { duration: 0.4, ease: EASE, delay: 0.5 + i * 0.05 }
              }
            />
          ))}
        </div>

        {/* white wash — clears the stillness side and fades the noise into it */}
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 w-[52%] pointer-events-none"
          style={{
            background:
              "linear-gradient(270deg, rgba(244,242,238,0.92) 0%, rgba(244,242,238,0.55) 55%, rgba(244,242,238,0) 100%)",
          }}
        />

        {/* the divide — silence on one side of the line */}
        <div
          aria-hidden
          className="absolute top-[26vh] bottom-[18vh] left-[57%] w-px bg-text/10"
        />

        {/* RIGHT — the stillness */}
        <motion.div
          className="absolute inset-y-0 right-0 z-10 flex w-[43%] flex-col items-center justify-center px-[3vw] text-center"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.7, ease: EASE, delay: 0.4 }}
        >
          <div className="font-display font-light tracking-[-0.02em] text-[4.4vw] leading-none text-text">
            AForce.
          </div>
          <div className="mt-[3vh] font-display uppercase tracking-[0.34em] text-[0.82vw] text-red font-semibold">
            Composure before execution.
          </div>
        </motion.div>

        {/* HEADER — kept top-left, riding above the noise */}
        <div className="absolute top-[14vh] left-[5vw] z-20 max-w-[42vw]">
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
        </div>
      </div>
    </SlideFrame>
  );
}
