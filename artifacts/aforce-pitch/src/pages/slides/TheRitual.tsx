import { motion } from "framer-motion";

import SlideFrame from "@/components/SlideFrame";

const BEATS: Array<{ word: string; tone: string }> = [
  { word: "Pause", tone: "text-red" },
  { word: "Hydrate", tone: "text-text" },
  { word: "Lock in", tone: "text-blue" },
  { word: "Perform", tone: "text-text" },
];

export default function TheRitual() {
  return (
    <SlideFrame slide={7}>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-[5vw]">
        <div className="mb-[6vh]">
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-blue font-semibold border-b-2 border-blue pb-[0.6vh]">
            The Ritual
          </span>
        </div>

        <div className="flex items-baseline justify-center gap-[3vw] flex-wrap">
          {BEATS.map((beat, i) => (
            <motion.div
              key={beat.word}
              className="flex items-baseline"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                ease: [0.22, 0.61, 0.36, 1],
                delay: 0.3 + i * 0.18,
              }}
            >
              <span
                className={`font-display font-light tracking-[-0.03em] text-[4.6vw] leading-none ${beat.tone}`}
              >
                {beat.word}
              </span>
              {i < BEATS.length - 1 && (
                <span className="font-display font-light text-[4.6vw] leading-none text-text/20 ml-[3vw]">
                  /
                </span>
              )}
            </motion.div>
          ))}
        </div>

        <motion.p
          className="mt-[7vh] font-display text-[1.15vw] leading-[1.5] text-text/60 text-center max-w-[44vw]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 1.1 }}
        >
          One behavior, four beats. The system that turns hydration into
          readiness.
        </motion.p>
      </div>
    </SlideFrame>
  );
}
