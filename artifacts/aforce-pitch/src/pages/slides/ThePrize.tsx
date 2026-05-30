import { useEffect, useState } from "react";
import { motion, animate, type MotionProps } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const BARS = [
  { year: "2024", h: 34, label: "$1.4B" },
  { year: "2026", h: 52, label: "$2.1B" },
  { year: "2028", h: 74, label: "$3.0B" },
  { year: "2030", h: 100, label: "$4.2B" },
];

const EASE = [0.16, 1, 0.3, 1] as const;

export default function ThePrize() {
  const reduce = useReducedMotion();
  const [val, setVal] = useState(reduce ? 4.2 : 0);

  // When reduced motion is requested, strip entrance props so elements
  // render in their final resting state with no movement or timed reveal.
  const enter = (
    props: Pick<MotionProps, "initial" | "animate" | "transition">,
  ): Pick<MotionProps, "initial" | "animate" | "transition"> =>
    reduce ? {} : props;

  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, 4.2, {
      duration: 1.6,
      ease: EASE,
      onUpdate: (v) => setVal(v),
    });
    return () => controls.stop();
  }, [reduce]);

  return (
    <SlideFrame slide={4}>
      <div className="absolute inset-0 flex">
        {/* LEFT — the number */}
        <div className="w-[52%] flex flex-col justify-center px-[5vw]">
          <motion.div
            className="mb-[4vh]"
            {...enter({
              initial: { opacity: 0, y: 14 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.6, ease: EASE },
            })}
          >
            <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
              The Prize
            </span>
          </motion.div>

          <motion.div
            className="font-display font-normal tracking-[0.01em] text-[8vw] leading-[0.9] text-text tabular-nums"
            {...enter({
              initial: { opacity: 0, y: 20 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.7, ease: EASE, delay: 0.05 },
            })}
          >
            ${val.toFixed(1)}
            <span className="text-red">B</span>
          </motion.div>
          <motion.div
            className="mt-[2vh] font-display uppercase tracking-[0.22em] text-[0.8vw] text-text/55 font-medium"
            {...enter({
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              transition: { duration: 0.6, ease: EASE, delay: 0.45 },
            })}
          >
            U.S. performance hydration by 2030 · illustrative
          </motion.div>

          <motion.p
            className="mt-[4vh] max-w-[34vw] font-body text-[1.1vw] leading-[1.55] text-text/70"
            {...enter({
              initial: { opacity: 0, y: 16 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.7, ease: EASE, delay: 0.6 },
            })}
          >
            The market is evolving beyond energy into readiness, recovery, and
            daily ritual — and nobody owns the behavior.
          </motion.p>
        </div>

        {/* RIGHT — growth chart */}
        <div className="w-[48%] flex items-center pr-[7vw] pl-[2vw]">
          <div className="w-full">
            <div className="relative flex items-end justify-between gap-[2vw] h-[42vh]">
              {/* soft pulsing glow behind the hero bar */}
              {!reduce && (
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute bottom-0 right-[2%] w-[18%] h-full rounded-full bg-red/25 blur-[3vw]"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: [0, 0.9, 0.55, 0.9], scale: [0.6, 1.05, 0.95, 1.05] }}
                  transition={{
                    opacity: { duration: 4, ease: "easeInOut", repeat: Infinity, delay: 1 },
                    scale: { duration: 4, ease: "easeInOut", repeat: Infinity, delay: 1 },
                  }}
                />
              )}

              {BARS.map((b, i) => {
                const isHero = i === BARS.length - 1;
                return (
                  <div
                    key={b.year}
                    className="relative flex-1 flex flex-col items-center justify-end h-full"
                  >
                    <motion.div
                      className="font-display text-[1.1vw] font-medium text-text mb-[1.2vh]"
                      {...enter({
                        initial: { opacity: 0, y: 8 },
                        animate: { opacity: 1, y: 0 },
                        transition: {
                          duration: 0.5,
                          ease: EASE,
                          delay: 0.5 + i * 0.14,
                        },
                      })}
                    >
                      {b.label}
                    </motion.div>
                    <motion.div
                      className={`w-full origin-bottom rounded-t-[0.3vw] ${
                        isHero
                          ? "bg-red shadow-[0_0_3vw_rgba(225,29,42,0.35)]"
                          : "bg-text/20"
                      }`}
                      style={{ height: `${b.h}%` }}
                      initial={{ scaleY: reduce ? 1 : 0, opacity: reduce ? 1 : 0.4 }}
                      animate={{ scaleY: 1, opacity: 1 }}
                      transition={{
                        scaleY: {
                          type: "spring",
                          stiffness: 90,
                          damping: 15,
                          delay: 0.25 + i * 0.14,
                        },
                        opacity: { duration: 0.4, delay: 0.25 + i * 0.14 },
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <motion.div
              className="flex justify-between gap-[2vw] mt-[1.4vh] border-t border-text/20 pt-[1.2vh]"
              {...enter({
                initial: { opacity: 0 },
                animate: { opacity: 1 },
                transition: { duration: 0.6, ease: EASE, delay: 0.7 },
              })}
            >
              {BARS.map((b) => (
                <div
                  key={b.year}
                  className="flex-1 text-center font-display uppercase tracking-[0.18em] text-[0.7vw] text-text/50"
                >
                  {b.year}
                </div>
              ))}
            </motion.div>

            <motion.p
              className="mt-[2.2vh] font-body italic text-[0.82vw] tracking-[0.03em] leading-[1.55] text-text/50 max-w-[40vw]"
              {...enter({
                initial: { opacity: 0, y: 12 },
                animate: { opacity: 1, y: 0 },
                transition: { duration: 0.6, ease: EASE, delay: 0.85 },
              })}
            >
              The window is now. Behavioral readiness is replacing stimulation
              as the performance category standard — and nobody owns it yet.
            </motion.p>
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}
