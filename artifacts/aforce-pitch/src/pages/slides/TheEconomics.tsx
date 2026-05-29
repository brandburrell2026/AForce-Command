import { motion } from "framer-motion";

import SlideFrame from "@/components/SlideFrame";

const METRICS = [
  { k: "CAC", v: "< $45" },
  { k: "LTV", v: "$210" },
  { k: "Sub. Conversion", v: "20%+" },
  { k: "Repeat Purchase", v: "28–32%" },
  { k: "Gross Margin", v: "~68%" },
  { k: "LTV / CAC", v: "3.4×" },
];

const FORECAST = [
  { year: "Y1", h: 26 },
  { year: "Y2", h: 54 },
  { year: "Y3", h: 100 },
];

export default function TheEconomics() {
  return (
    <SlideFrame slide={13}>
      <div className="absolute inset-0 flex">
        {/* LEFT — metrics table */}
        <div className="w-[54%] flex flex-col justify-center px-[5vw]">
          <div className="mb-[4vh]">
            <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-blue font-semibold border-b-2 border-blue pb-[0.6vh]">
              The Economics
            </span>
          </div>

          <h1 className="font-display font-light tracking-[-0.025em] text-[4vw] leading-[1.02] text-text mb-[1.6vh]">
            Behavior compounds{" "}
            <span className="text-red font-normal">into revenue.</span>
          </h1>
          <div className="font-display uppercase tracking-[0.2em] text-[0.7vw] text-text/45 font-medium mb-[3vh]">
            Illustrative assumptions
          </div>

          <div className="grid grid-cols-2 gap-x-[3vw]">
            {METRICS.map((m, i) => (
              <motion.div
                key={m.k}
                className="flex items-baseline justify-between border-b border-text/15 py-[1.6vh]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.35 + i * 0.08 }}
              >
                <span className="font-display uppercase tracking-[0.16em] text-[0.72vw] text-text/55 font-medium">
                  {m.k}
                </span>
                <span className="font-display text-[1.5vw] text-text font-light tabular-nums">
                  {m.v}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* RIGHT — revenue forecast */}
        <div className="w-[46%] flex items-center pr-[7vw] pl-[2vw]">
          <div className="w-full">
            <div className="font-display uppercase tracking-[0.22em] text-[0.7vw] text-text/50 font-medium mb-[3vh]">
              Revenue forecast · illustrative
            </div>
            <div className="flex items-end justify-between gap-[2.5vw] h-[38vh]">
              {FORECAST.map((b, i) => (
                <div key={b.year} className="flex-1 flex flex-col items-center justify-end h-full">
                  <motion.div
                    className={`w-full rounded-t-[0.3vw] ${i === FORECAST.length - 1 ? "bg-blue" : "bg-text/20"}`}
                    initial={{ height: 0 }}
                    animate={{ height: `${b.h}%` }}
                    transition={{ duration: 0.8, delay: 0.4 + i * 0.16, ease: [0.22, 0.61, 0.36, 1] }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between gap-[2.5vw] mt-[1.4vh] border-t border-text/20 pt-[1.2vh]">
              {FORECAST.map((b) => (
                <div key={b.year} className="flex-1 text-center font-display uppercase tracking-[0.18em] text-[0.72vw] text-text/50">
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
