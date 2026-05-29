import { motion } from "framer-motion";

import SlideFrame from "@/components/SlideFrame";

const BADGES = [
  { k: "Platform", v: "National Television" },
  { k: "Status", v: "Selected — Hundreds Reviewed" },
  { k: "On Air", v: "January 2027" },
];

export default function RealDeal() {
  return (
    <SlideFrame slide={3}>
      <div className="absolute inset-0 flex flex-col justify-center px-[5vw]">
        <div className="mb-[5vh]">
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-blue font-semibold border-b-2 border-blue pb-[0.6vh]">
            Validation
          </span>
        </div>

        <h1 className="font-display font-light tracking-[-0.025em] text-[5.4vw] leading-[1.02] text-text max-w-[80%]">
          <div>Selected for</div>
          <div className="text-blue font-normal">America's Real Deal.</div>
        </h1>

        <p className="mt-[4vh] max-w-[46vw] font-display text-[1.2vw] leading-[1.5] text-text/70">
          Chosen from hundreds of companies for a nationally televised
          investment platform. This raise builds the proof we walk in with.
        </p>

        <div className="mt-[6vh] flex gap-[1.6vw]">
          {BADGES.map((b, i) => (
            <motion.div
              key={b.v}
              className="border border-text/20 rounded-[0.4vw] px-[1.6vw] py-[1.6vh] bg-bg-elev/60"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.45 + i * 0.14 }}
            >
              <div className="font-display uppercase tracking-[0.28em] text-[0.6vw] text-text/45 font-medium">
                {b.k}
              </div>
              <div className="mt-[1vh] font-display text-[1.25vw] leading-tight text-text font-medium">
                {b.v}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
