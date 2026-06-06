import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

const STOPS = [
  { date: "Jul 2026", t: "First Cohort", m: "Concierge launch, first behavioral data" },
  { date: "Aug 2026", t: "Habit Validated", m: "Ritual adoption and retention confirmed" },
  {
    date: "Oct 2026",
    t: "Ecosystem Proven",
    m: "OS engagement, subscription conversion, community density",
  },
  { date: "Jan 2027", t: "National Stage", m: "America's Real Deal. We arrive with proof." },
];

// The four numbers that define "proven." Data-forward scoreboard, color-coded
// by proof tier (red = behavioral, blue = ecosystem, neutral = commerce/financial).
const TARGETS = [
  { value: ">50%", label: "Day 30 retention", tier: "Behavioral", value_c: "text-red", bar: "bg-red" },
  { value: ">50%", label: "OS activation", tier: "Ecosystem", value_c: "text-blue", bar: "bg-blue" },
  {
    value: ">20%",
    label: "Subscription conversion",
    tier: "Commerce",
    value_c: "text-text",
    bar: "bg-text/55",
  },
  { value: ">5×", label: "LTV / CAC", tier: "Financial", value_c: "text-text", bar: "bg-text/35" },
];

const SIGNALS =
  "Also tracked — ritual adoption · weekly & monthly active users · streak participation · 3+ weekly engagements · repeat purchase >30% · AOV · CAC < $32 (stop at $50) · positive contribution margin";

export default function RoadToRealDeal() {
  const reduce = useReducedMotion();
  const last = STOPS.length - 1;

  return (
    <SlideFrame slide={15}>
      <div className="absolute inset-0 flex flex-col justify-center px-[5vw] pt-[12vh] pb-[10vh]">
        {/* header */}
        <div>
          <motion.div
            className="mb-[3.5vh]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
          >
            <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
              The Road
            </span>
          </motion.div>

          <motion.h1
            className="font-display font-light tracking-[-0.025em] text-[4.2vw] leading-[1.02] text-text"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
          >
            Building proof before the{" "}
            <span className="text-blue font-normal">national stage.</span>
          </motion.h1>

          <motion.p
            className="mt-[2.6vh] font-body text-[1.05vw] leading-[1.5] text-text/60 max-w-[42vw]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.18 }}
          >
            We've already secured the platform. This raise builds the proof we
            walk in with.
          </motion.p>
        </div>

        {/* timeline */}
        <div className="mt-[6vh] relative">
          {/* base rail */}
          <div className="absolute left-0 right-0 top-[0.75vh] h-[2px] bg-text/12" />
          {/* animated progress fill */}
          <motion.div
            className="absolute left-0 top-[0.75vh] h-[2px] bg-red origin-left"
            style={{ right: 0 }}
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={reduce ? undefined : { duration: 1.1, ease: EASE, delay: 0.35 }}
          />

          <div className="grid grid-cols-4 gap-[2.5vw]">
            {STOPS.map((s, i) => {
              const isLast = i === last;
              return (
                <motion.div
                  key={s.date}
                  className="relative pt-[4.5vh]"
                  initial={reduce ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.4 + i * 0.12 }
                  }
                >
                  {/* phase index */}
                  <div
                    className={`font-display tracking-[0.1em] text-[0.7vw] font-semibold mb-[1.2vh] ${
                      isLast ? "text-blue" : "text-text/30"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </div>

                  {/* node on the rail — arrival, gently differentiated */}
                  {isLast ? (
                    <span className="absolute -top-[0.3vh] left-0 flex items-center justify-center">
                      <span className="absolute w-[2vw] h-[2vw] rounded-full border border-blue/25" />
                      <span className="w-[1.3vw] h-[1.3vw] rounded-full bg-blue shadow-[0_4px_14px_rgba(47,91,255,0.35)]" />
                    </span>
                  ) : (
                    <span className="absolute top-0 left-0 w-[1.1vw] h-[1.1vw] rounded-full bg-red ring-[0.35vw] ring-bg" />
                  )}

                  <div className="font-display uppercase tracking-[0.22em] text-[0.7vw] text-text/45 font-medium">
                    {s.date}
                  </div>
                  <div
                    className={`mt-[1.4vh] font-display text-[1.7vw] leading-tight ${
                      isLast ? "text-blue font-normal" : "text-text font-normal"
                    }`}
                  >
                    {s.t}
                  </div>
                  <div className="mt-[1.2vh] font-body text-[0.92vw] leading-[1.5] text-text/60 max-w-[15vw]">
                    {s.m}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* PHASE 1 PROOF SCOREBOARD — the four numbers that define "proven" */}
        <motion.div
          className="mt-[7vh]"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.55 }}
        >
          <div className="flex items-baseline gap-[1.4vw] mb-[2.6vh]">
            <span className="font-display uppercase tracking-[0.3em] text-[0.72vw] text-red font-semibold whitespace-nowrap">
              What “Proven” Looks Like
            </span>
            <span className="font-body italic text-[0.72vw] leading-[1.4] text-text/45">
              Phase 1 is not about awareness — it is about proving behavior,
              retention, and ecosystem engagement.
            </span>
          </div>

          {/* big-number proof targets */}
          <div className="grid grid-cols-4 gap-[2.5vw]">
            {TARGETS.map((tgt, i) => (
              <motion.div
                key={tgt.label}
                className="relative pt-[1.6vh]"
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.62 + i * 0.08 }
                }
              >
                {/* accent bar */}
                <span className={`absolute top-0 left-0 h-[2px] w-[2.4vw] ${tgt.bar}`} />
                <div
                  className={`font-display font-light tracking-[-0.03em] text-[3.4vw] leading-[0.95] ${tgt.value_c}`}
                >
                  {tgt.value}
                </div>
                <div className="mt-[1.4vh] font-display text-[1vw] leading-tight text-text/85">
                  {tgt.label}
                </div>
                <div className="mt-[0.8vh] font-display uppercase tracking-[0.24em] text-[0.58vw] text-text/40 font-semibold">
                  {tgt.tier}
                </div>
              </motion.div>
            ))}
          </div>

          {/* supporting qualitative signals — one quiet line */}
          <motion.p
            className="mt-[3vh] font-body text-[0.74vw] leading-[1.4] text-text/45"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 1.0 }}
          >
            {SIGNALS}
          </motion.p>
        </motion.div>
      </div>
    </SlideFrame>
  );
}
