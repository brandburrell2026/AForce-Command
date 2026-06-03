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
  blur?: number;
};

// The category, shouting over itself — loud names up front, smaller echoes
// blurring into the din. Fills the whole left canvas with real density.
const BRANDS: Brand[] = [
  { t: "MONSTER", top: "15%", left: "1%", size: "8vw", rot: -7, o: 0.24 },
  { t: "CELSIUS", top: "30%", left: "21%", size: "5.4vw", rot: 5, o: 0.16, blur: 1 },
  { t: "RED BULL", top: "44%", left: "2%", size: "6.8vw", rot: -4, o: 0.21 },
  { t: "PRIME", top: "60%", left: "22%", size: "6vw", rot: 8, o: 0.15 },
  { t: "GHOST", top: "75%", left: "1%", size: "5.2vw", rot: -11, o: 0.15, blur: 1 },
  { t: "LMNT", top: "87%", left: "27%", size: "3.8vw", rot: 13, o: 0.12 },
  { t: "GATORADE", top: "23%", left: "34%", size: "3.2vw", rot: -16, o: 0.1, blur: 1.5 },
  { t: "CELSIUS", top: "52%", left: "37%", size: "3vw", rot: 18, o: 0.09, blur: 1.5 },
  { t: "MONSTER", top: "68%", left: "41%", size: "2.6vw", rot: -9, o: 0.08, blur: 2 },
  { t: "PRIME", top: "11%", left: "27%", size: "2.8vw", rot: 6, o: 0.1, blur: 1.5 },
  { t: "RED BULL", top: "91%", left: "14%", size: "2.4vw", rot: -6, o: 0.08, blur: 2 },
  { t: "GHOST", top: "38%", left: "41%", size: "2.2vw", rot: 14, o: 0.07, blur: 2 },
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

  return (
    <SlideFrame slide={7}>
      <div className="absolute inset-0 overflow-hidden">
        {/* LEFT — the chaos */}
        <div className="absolute inset-y-0 left-0 w-[60%] overflow-hidden">
          {BRANDS.map((b, i) => (
            <motion.div
              key={`${b.t}-${i}`}
              aria-hidden
              className="absolute font-display font-extrabold tracking-tight text-text whitespace-nowrap select-none"
              style={{
                top: b.top,
                left: b.left,
                fontSize: b.size,
                filter: b.blur ? `blur(${b.blur}px)` : undefined,
              }}
              initial={reduce ? false : { opacity: 0, scale: 0.9, rotate: b.rot }}
              animate={
                reduce
                  ? { opacity: b.o }
                  : { opacity: b.o, scale: 1, rotate: b.rot, y: [0, i % 2 ? 7 : -7, 0] }
              }
              transition={
                reduce
                  ? undefined
                  : {
                      opacity: { duration: 0.6, ease: EASE, delay: 0.04 + i * 0.04 },
                      scale: { duration: 0.6, ease: EASE, delay: 0.04 + i * 0.04 },
                      y: {
                        duration: 6 + (i % 4),
                        ease: "easeInOut",
                        repeat: Infinity,
                        delay: i * 0.2,
                      },
                    }
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
                "radial-gradient(62% 62% at 28% 48%, rgba(239,236,230,0.96) 0%, rgba(239,236,230,0) 100%)",
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

        {/* RIGHT — the stillness */}
        <motion.div
          className="absolute inset-y-0 right-0 z-10 flex w-[40%] flex-col items-center justify-center px-[3vw] text-center"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.7, ease: EASE, delay: 0.45 }}
        >
          <motion.span
            aria-hidden
            className="block rounded-full bg-red"
            style={{ width: "0.9vw", height: "0.9vw" }}
            animate={reduce ? undefined : { opacity: [0.5, 1, 0.5], scale: [1, 1.35, 1] }}
            transition={reduce ? undefined : { duration: 2.4, ease: "easeInOut", repeat: Infinity }}
          />
          <div className="mt-[4vh] font-display font-light tracking-[-0.03em] text-[5vw] leading-none text-text">
            AForce.
          </div>
          <div className="mt-[3vh] h-px w-[4vw] bg-red" />
          <div className="mt-[3vh] font-display uppercase tracking-[0.36em] text-[0.85vw] text-red font-semibold">
            Composure before execution.
          </div>
        </motion.div>
      </div>
    </SlideFrame>
  );
}
