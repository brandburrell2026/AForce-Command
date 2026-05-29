import { Fragment } from "react";
import { motion, useReducedMotion } from "framer-motion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

const BEATS: Array<{ word: string; tone: string; dot: string; idx: string }> = [
  { word: "Pause", tone: "text-red", dot: "bg-red", idx: "01" },
  { word: "Hydrate", tone: "text-text", dot: "bg-text/30", idx: "02" },
  { word: "Lock in", tone: "text-blue", dot: "bg-blue", idx: "03" },
  { word: "Perform", tone: "text-text", dot: "bg-text/30", idx: "04" },
];

export default function TheRitual() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={7}>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-[5vw]">
        {/* eyebrow */}
        <motion.div
          className="mb-[8vh] flex items-center gap-[1vw]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="h-[2px] w-[3vw] bg-blue" />
          <span className="font-display uppercase tracking-[0.34em] text-[0.78vw] text-blue font-semibold">
            The Ritual
          </span>
          <span className="h-[2px] w-[3vw] bg-blue" />
        </motion.div>

        {/* the four beats — a sequence in time */}
        <div className="flex items-center justify-center gap-[1.7vw] whitespace-nowrap">
          {BEATS.map((beat, i) => (
            <Fragment key={beat.word}>
              {i > 0 && (
                <motion.span
                  aria-hidden
                  className="font-display font-light text-[1.9vw] leading-none text-text/20"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={
                    reduce
                      ? undefined
                      : { duration: 0.4, ease: EASE, delay: 0.1 + i * 0.06 }
                  }
                >
                  &rarr;
                </motion.span>
              )}

              <motion.div
                className="flex flex-col items-center gap-[1.8vh]"
                initial={reduce ? false : { opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduce
                    ? undefined
                    : { duration: 0.45, ease: EASE, delay: 0.08 + i * 0.06 }
                }
              >
                <span className="font-display uppercase tracking-[0.4em] text-[0.8vw] text-text/35 font-semibold tabular-nums">
                  {beat.idx}
                </span>
                <span
                  className={`font-display font-light tracking-[-0.03em] text-[3.6vw] leading-none ${beat.tone}`}
                >
                  {beat.word}
                </span>
                <span className={`h-[0.5vw] w-[0.5vw] rounded-full ${beat.dot}`} />
              </motion.div>
            </Fragment>
          ))}
        </div>

        {/* one supporting thought */}
        <motion.p
          className="mt-[9vh] font-body text-[1.15vw] leading-[1.55] text-text/60 text-center max-w-[44vw]"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.5 }}
        >
          One behavior, four beats. The system that turns hydration into
          readiness.
        </motion.p>
      </div>
    </SlideFrame>
  );
}
