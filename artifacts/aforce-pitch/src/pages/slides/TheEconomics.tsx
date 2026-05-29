import { motion, useReducedMotion } from "framer-motion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

const METRICS = [
  { k: "CAC", v: "< $45" },
  { k: "LTV", v: "$210" },
  { k: "Sub. Conversion", v: "20%+" },
  { k: "Repeat Purchase", v: "28–32%" },
  { k: "Gross Margin", v: "~68%" },
  { k: "LTV / CAC", v: "3.4×", hero: true },
];

const FORECAST = [
  { year: "Y1", h: 26, fill: "bg-blue/30" },
  { year: "Y2", h: 54, fill: "bg-blue/60" },
  { year: "Y3", h: 100, fill: "bg-red" },
];

export default function TheEconomics() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={13}>
      <div className="absolute inset-0 flex pt-[12vh] pb-[10vh]">
        {/* LEFT — metrics table */}
        <div className="w-[54%] flex flex-col justify-center px-[5vw]">
          <motion.div
            className="mb-[3.5vh]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
          >
            <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-blue font-semibold border-b-2 border-blue pb-[0.6vh]">
              The Economics
            </span>
          </motion.div>

          <motion.h1
            className="font-display font-light tracking-[-0.025em] text-[3.7vw] leading-[1.02] text-text mb-[1.4vh]"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
          >
            Behavior compounds{" "}
            <span className="text-red font-normal">into revenue.</span>
          </motion.h1>
          <div className="font-display uppercase tracking-[0.2em] text-[0.7vw] text-text/40 font-medium mb-[3.5vh]">
            Illustrative assumptions
          </div>

          <div className="grid grid-cols-2 gap-x-[3vw]">
            {METRICS.map((m, i) => (
              <motion.div
                key={m.k}
                className={`flex items-baseline justify-between py-[1.7vh] ${
                  m.hero ? "border-b-2 border-red/60" : "border-b border-text/15"
                }`}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduce ? undefined : { duration: 0.45, ease: EASE, delay: 0.25 + i * 0.07 }
                }
              >
                <span
                  className={`font-display uppercase tracking-[0.16em] text-[0.72vw] font-medium ${
                    m.hero ? "text-red" : "text-text/55"
                  }`}
                >
                  {m.k}
                </span>
                <span
                  className={`font-display text-[1.5vw] tabular-nums ${
                    m.hero ? "text-red font-normal" : "text-text font-light"
                  }`}
                >
                  {m.v}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* RIGHT — revenue forecast */}
        <div className="w-[46%] flex items-center pr-[6vw] pl-[2vw]">
          <div className="w-full">
            <div className="flex items-end justify-between mb-[3vh]">
              <div className="font-display uppercase tracking-[0.22em] text-[0.7vw] text-text/45 font-medium">
                Revenue forecast · illustrative
              </div>
              <motion.div
                className="text-right"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.9 }}
              >
                <span className="font-display text-[2vw] text-red font-normal leading-none">
                  ≈ 4×
                </span>
                <div className="font-display uppercase tracking-[0.2em] text-[0.6vw] text-text/45 mt-[0.6vh]">
                  in 36 months
                </div>
              </motion.div>
            </div>

            <div className="flex items-end justify-between gap-[2.5vw] h-[34vh]">
              {FORECAST.map((b, i) => (
                <div
                  key={b.year}
                  className="flex-1 flex flex-col items-center justify-end h-full"
                >
                  <motion.div
                    className="font-display text-[1.1vw] text-text/70 font-light tabular-nums mb-[1vh]"
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={
                      reduce ? undefined : { duration: 0.4, ease: EASE, delay: 0.7 + i * 0.18 }
                    }
                  >
                    {b.h}
                  </motion.div>
                  <motion.div
                    className={`w-full rounded-t-[0.3vw] origin-bottom ${b.fill}`}
                    style={{ height: `${b.h}%` }}
                    initial={reduce ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={
                      reduce ? undefined : { duration: 0.7, ease: EASE, delay: 0.45 + i * 0.18 }
                    }
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between gap-[2.5vw] mt-[1.4vh] border-t border-text/20 pt-[1.2vh]">
              {FORECAST.map((b) => (
                <div
                  key={b.year}
                  className="flex-1 text-center font-display uppercase tracking-[0.18em] text-[0.72vw] text-text/50"
                >
                  {b.year}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}
