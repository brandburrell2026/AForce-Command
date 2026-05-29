import { Fragment } from "react";
import { motion, useReducedMotion } from "framer-motion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

type Beat = { idx: string; word: string; note: string; tone: string; dot: string; accent?: boolean };

const BEATS: Beat[] = [
  { idx: "01", word: "Pause", note: "Stop the noise", tone: "text-red", dot: "bg-red" },
  { idx: "02", word: "Hydrate", note: "Start with water", tone: "text-blue", dot: "bg-blue", accent: true },
  { idx: "03", word: "Lock in", note: "Set the intent", tone: "text-text", dot: "bg-text/30" },
  { idx: "04", word: "Perform", note: "Execute clean", tone: "text-text", dot: "bg-text/30" },
];

export default function TheRitual() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={7}>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-[6vw]">
        {/* eyebrow */}
        <motion.div
          className="mb-[2.6vh] flex items-center gap-[1vw]"
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

        {/* kicker */}
        <motion.h1
          className="mb-[7vh] font-display font-light tracking-[-0.025em] text-[2.5vw] leading-[1.05] text-text/85 text-center"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.08 }}
        >
          One behavior. <span className="text-text">Four beats.</span>
        </motion.h1>

        {/* the four beats — a sequence in time, on a single rail */}
        <div className="relative w-full max-w-[78vw]">
          {/* the rail behind the dots */}
          <motion.span
            aria-hidden
            className="absolute left-0 right-0 h-px bg-text/15 origin-left"
            style={{ top: "calc(50% - 0.05vh)" }}
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={reduce ? undefined : { duration: 0.9, ease: EASE, delay: 0.25 }}
          />

          <div className="relative flex items-stretch justify-between">
            {BEATS.map((beat, i) => (
              <Fragment key={beat.word}>
                <motion.div
                  className="flex flex-1 flex-col items-center text-center"
                  initial={reduce ? false : { opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.3 + i * 0.1 }}
                >
                  {/* index */}
                  <span className="font-display uppercase tracking-[0.4em] text-[0.72vw] text-text/35 font-semibold tabular-nums">
                    {beat.idx}
                  </span>

                  {/* word */}
                  <span
                    className={`mt-[1.4vh] font-display font-light tracking-[-0.03em] text-[3.9vw] leading-[0.92] ${beat.tone}`}
                  >
                    {beat.word}
                  </span>

                  {/* node on the rail */}
                  <span className="relative my-[2.4vh] flex h-[1vw] w-[1vw] items-center justify-center">
                    {beat.accent && !reduce && (
                      <motion.span
                        aria-hidden
                        className="absolute h-[1vw] w-[1vw] rounded-full bg-blue/30"
                        animate={{ scale: [1, 2.2, 1], opacity: [0.55, 0, 0.55] }}
                        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                      />
                    )}
                    <span className={`h-[0.62vw] w-[0.62vw] rounded-full ring-4 ring-bg ${beat.dot}`} />
                  </span>

                  {/* note */}
                  <span className="font-body text-[0.95vw] leading-none text-text/45">{beat.note}</span>
                </motion.div>

                {/* connector */}
                {i < BEATS.length - 1 && (
                  <motion.span
                    aria-hidden
                    className="flex w-[2vw] shrink-0 items-center justify-center font-display font-light text-[1.6vw] leading-none text-text/20"
                    style={{ alignSelf: "center" }}
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={reduce ? undefined : { duration: 0.4, ease: EASE, delay: 0.5 + i * 0.1 }}
                  >
                    &rarr;
                  </motion.span>
                )}
              </Fragment>
            ))}
          </div>
        </div>

        {/* one supporting thought */}
        <motion.p
          className="mt-[8vh] max-w-[44vw] text-center font-body text-[1.15vw] leading-[1.55] text-text/60"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.85 }}
        >
          One behavior, four beats. The system that turns hydration into readiness.
        </motion.p>
      </div>
    </SlideFrame>
  );
}
