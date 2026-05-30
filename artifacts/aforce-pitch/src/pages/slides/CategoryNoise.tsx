import { motion, useReducedMotion } from "framer-motion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

// Three visuals max — the loudest names in the category, overlapping as noise.
const NOISE = [
  { t: "MONSTER", top: "20%", left: "60%", size: "6vw", rot: -7, o: 0.13 },
  { t: "CELSIUS", top: "44%", left: "70%", size: "5vw", rot: 5, o: 0.16 },
  { t: "PRIME", top: "64%", left: "58%", size: "7vw", rot: -3, o: 0.11 },
];

export default function CategoryNoise() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={5}>
      <div className="absolute inset-0 overflow-hidden">
        {/* the chaos — three competitor wordmarks, overlapping, restless */}
        {NOISE.map((n, i) => (
          <motion.div
            key={n.t}
            aria-hidden
            className="absolute font-display font-extrabold tracking-tight text-text whitespace-nowrap select-none"
            style={{ top: n.top, left: n.left, fontSize: n.size }}
            initial={
              reduce
                ? false
                : { opacity: 0, scale: 1.15, rotate: n.rot, x: 30, filter: "blur(6px)" }
            }
            animate={
              reduce
                ? { opacity: n.o, rotate: n.rot }
                : {
                    opacity: n.o,
                    scale: 1,
                    rotate: [n.rot - 1, n.rot + 1, n.rot - 1],
                    x: [0, 3, -2, 0],
                    filter: "blur(0px)",
                  }
            }
            transition={
              reduce
                ? undefined
                : {
                    opacity: { duration: 0.35, ease: EASE, delay: i * 0.08 },
                    scale: { duration: 0.35, ease: EASE, delay: i * 0.08 },
                    filter: { duration: 0.35, ease: EASE, delay: i * 0.08 },
                    rotate: {
                      duration: 0.5 + i * 0.12,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.4 + i * 0.08,
                    },
                    x: {
                      duration: 0.6 + i * 0.1,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.4 + i * 0.08,
                    },
                  }
            }
          >
            {n.t}
          </motion.div>
        ))}

        {/* the message — calm, fast */}
        <div className="absolute inset-y-0 left-0 w-[52%] flex flex-col justify-center px-[5vw]">
          <motion.div
            className="mb-[5vh]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.4, ease: EASE }}
          >
            <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
              The Problem
            </span>
          </motion.div>

          <h1 className="font-display font-light tracking-[-0.025em] text-[5.6vw] leading-[1.02] text-text">
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? undefined : { duration: 0.45, ease: EASE, delay: 0.08 }}
            >
              The category
            </motion.div>
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? undefined : { duration: 0.45, ease: EASE, delay: 0.16 }}
            >
              is <span className="text-red font-normal">noise.</span>
            </motion.div>
          </h1>

          <motion.p
            className="mt-[4vh] max-w-[34vw] font-body text-[1.1vw] leading-[1.55] text-text/70"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.45, ease: EASE, delay: 0.28 }}
          >
            Every brand competes for attention. Almost none compete for
            composure.
          </motion.p>
        </div>
      </div>
    </SlideFrame>
  );
}
