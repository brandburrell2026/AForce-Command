import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

type Pillar = {
  n: string;
  t: string;
  d: string;
  meter: string;
  level: string;
  depth: number;
  bar: string;
  accent?: boolean;
};

const PILLARS: Pillar[] = [
  {
    n: "01",
    t: "Performance Data",
    d: "Every cycle teaches the OS more about you than any competitor can see.",
    meter: "Data depth",
    level: "Accrues daily",
    depth: 0.2,
    bar: "bg-red",
  },
  {
    n: "02",
    t: "Streak Psychology",
    d: "Breaking the streak costs more psychologically than starting it did.",
    meter: "Habit lock",
    level: "Compounds weekly",
    depth: 0.45,
    bar: "bg-text",
  },
  {
    n: "03",
    t: "Identity Formation",
    d: "AForce stops being a product and becomes part of how this person defines being on.",
    meter: "Identity",
    level: "Becomes permanent",
    depth: 0.85,
    bar: "bg-blue",
    accent: true,
  },
];

export default function TheMoat() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={13}>
      {/* faint depth glow, lower-right — the moat */}
      <div
        aria-hidden
        className="absolute right-[-8vw] bottom-[-10vh] h-[55vh] w-[55vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(228,30,43,0.10) 0%, rgba(228,30,43,0) 68%)",
          filter: "blur(8px)",
        }}
      />

      <div className="absolute inset-0 flex flex-col justify-center px-[5vw]">
        {/* eyebrow */}
        <motion.div
          className="mb-[3.4vh]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="font-display uppercase tracking-[0.34em] text-[0.78vw] text-blue font-semibold border-b-2 border-blue pb-[0.6vh]">
            The Moat
          </span>
        </motion.div>

        {/* headline */}
        <motion.h1
          className="font-display font-light tracking-[-0.025em] text-[4.2vw] leading-[1.02] text-text"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
        >
          The more you use it, the harder it is{" "}
          <span className="text-blue font-normal">to leave.</span>
        </motion.h1>

        <motion.p
          className="mt-[2.4vh] max-w-[42vw] font-body text-[1.05vw] leading-[1.5] text-text/55"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.18 }}
        >
          Three layers of lock-in accrue with every cycle.
        </motion.p>

        {/* the three layers */}
        <div className="mt-[6vh] grid grid-cols-3 gap-[3vw] items-stretch">
          {PILLARS.map((p, i) => {
            const fill = p.bar;
            const lvlTone = p.accent ? "text-blue" : "text-text/45";
            return (
              <motion.div
                key={p.n}
                className="relative flex h-full flex-col"
                initial={reduce ? false : { opacity: 0, y: 26 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.3 + i * 0.12 }
                }
              >
                {/* top rule, draws in */}
                <motion.span
                  aria-hidden
                  className={`block h-[2px] origin-left ${
                    p.accent ? "bg-blue" : "bg-text/80"
                  }`}
                  initial={reduce ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={
                    reduce ? undefined : { duration: 0.7, ease: EASE, delay: 0.34 + i * 0.12 }
                  }
                />

                <div className="pt-[2vh] flex flex-1 flex-col">
                  <div
                    className={`font-display text-[1.4vw] font-light tabular-nums mb-[1.4vh] ${
                      p.accent ? "text-blue" : "text-red"
                    }`}
                  >
                    {p.n}
                  </div>
                  <div className="font-display text-[1.7vw] text-text font-normal leading-tight mb-[1.6vh]">
                    {p.t}
                  </div>
                  <p className="font-body text-[0.9vw] leading-[1.55] text-text/65">
                    {p.d}
                  </p>

                  {/* switching-cost depth meter */}
                  <div className="mt-auto pt-[3.4vh]">
                    <div className="mb-[1vh] flex items-baseline justify-between">
                      <span className="font-display uppercase tracking-[0.28em] text-[0.62vw] text-text/35 font-semibold">
                        {p.meter}
                      </span>
                      <span
                        className={`font-display uppercase tracking-[0.16em] text-[0.62vw] font-semibold ${lvlTone}`}
                      >
                        {p.level}
                      </span>
                    </div>
                    <div className="relative h-[4px] w-full overflow-hidden rounded-full bg-text/10">
                      <motion.span
                        className={`absolute inset-y-0 left-0 origin-left rounded-full ${fill}`}
                        style={{ width: `${p.depth * 100}%` }}
                        initial={reduce ? false : { scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={
                          reduce
                            ? undefined
                            : { duration: 0.9, ease: EASE, delay: 0.6 + i * 0.12 }
                        }
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.p
          className="mt-[4.5vh] mx-auto max-w-[60vw] text-center font-body italic text-[0.82vw] leading-[1.6] text-text/45"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.95 }}
        >
          What stops a well-funded competitor from building the same loop?
          Behavioral data accumulation, streak psychology, and identity
          attachment. These cannot be bought. They are earned through daily use.
        </motion.p>
      </div>
    </SlideFrame>
  );
}
