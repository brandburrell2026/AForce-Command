import { motion } from "framer-motion";

import SlideFrame from "@/components/SlideFrame";

const PILLARS = [
  {
    n: "01",
    t: "Performance Data",
    d: "Every cycle teaches the OS more about the user than any competitor can see.",
  },
  {
    n: "02",
    t: "Streak Psychology",
    d: "Consistency compounds. Breaking the streak costs more than starting it did.",
  },
  {
    n: "03",
    t: "Identity Formation",
    d: "AForce stops being a product and becomes part of who the user is.",
  },
];

export default function TheMoat() {
  return (
    <SlideFrame slide={9}>
      <div className="absolute inset-0 flex flex-col justify-center px-[5vw]">
        <div className="mb-[4vh]">
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-blue font-semibold border-b-2 border-blue pb-[0.6vh]">
            The Moat
          </span>
        </div>

        <h1 className="font-display font-light tracking-[-0.025em] text-[4.4vw] leading-[1.02] text-text">
          The more you use it, the harder it is{" "}
          <span className="text-red font-normal">to leave.</span>
        </h1>

        <div className="mt-[7vh] grid grid-cols-3 gap-[3vw]">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.n}
              className="border-t-2 border-text/80 pt-[2vh]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.4 + i * 0.16 }}
            >
              <div className="font-display text-[1.4vw] text-red font-light tabular-nums mb-[1.4vh]">
                {p.n}
              </div>
              <div className="font-display text-[1.7vw] text-text font-normal leading-tight mb-[1.6vh]">
                {p.t}
              </div>
              <p className="font-display text-[0.95vw] leading-[1.5] text-text/65">
                {p.d}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
