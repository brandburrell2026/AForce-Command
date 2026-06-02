import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

const STOPS = [
  { date: "Jul 2026", t: "Soft Launch", m: "First concierge cohort" },
  { date: "Aug 2026", t: "Proof of Concept", m: "Habit + retention validated" },
  { date: "Oct 2026", t: "Community Scale", m: "Brickell density compounding" },
  { date: "Jan 2027", t: "National Television", m: "America's Real Deal, on air" },
];

const KPIS: Array<{ t: string; accent: string; items: string[] }> = [
  {
    t: "Commerce",
    accent: "text-red",
    items: ["CAC below $50", "Subscription conversion above 20%", "Repeat purchase above 30%"],
  },
  {
    t: "Behavior",
    accent: "text-blue",
    items: ["OS activation above 50%", "3+ weekly engagements", "Streak participation growth"],
  },
  {
    t: "Community",
    accent: "text-blue",
    items: ["Active member growth", "Referral participation", "Founder content engagement"],
  },
  {
    t: "Financial",
    accent: "text-red",
    items: ["LTV / CAC above 5×", "Positive contribution margin"],
  },
];

export default function RoadToRealDeal() {
  const base = import.meta.env.BASE_URL;
  const reduce = useReducedMotion();
  const last = STOPS.length - 1;

  return (
    <SlideFrame slide={12}>
      <div className="absolute inset-0 flex flex-col justify-center px-[5vw] pt-[12vh] pb-[10vh]">
        {/* header */}
        <div className="flex items-end justify-between">
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
              Road to{" "}
              <span className="text-blue font-normal">America's Real Deal.</span>
            </motion.h1>
          </div>

          {/* destination mark */}
          <motion.div
            className="flex flex-col items-end pb-[0.5vh]"
            initial={reduce ? false : { opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={reduce ? undefined : { duration: 0.7, ease: EASE, delay: 0.2 }}
          >
            <span className="font-display uppercase tracking-[0.28em] text-[0.62vw] text-blue font-semibold mb-[1.4vh]">
              The Destination
            </span>
            <img
              src={`${base}images/brand/americas-real-deal.png`}
              alt="America's Real Deal"
              className="w-[13vw] h-auto"
            />
          </motion.div>
        </div>

        {/* timeline */}
        <div className="mt-[7vh] relative">
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

                  {/* node on the rail */}
                  {isLast ? (
                    <span className="absolute -top-[0.35vh] left-0 flex items-center justify-center">
                      <motion.span
                        className="absolute w-[2.2vw] h-[2.2vw] rounded-full border border-blue/40"
                        initial={reduce ? false : { scale: 0.6, opacity: 0.7 }}
                        animate={
                          reduce
                            ? undefined
                            : { scale: [0.9, 1.5, 0.9], opacity: [0.6, 0, 0.6] }
                        }
                        transition={
                          reduce
                            ? undefined
                            : { duration: 2.4, ease: "easeInOut", repeat: Infinity, delay: 2 }
                        }
                      />
                      <span className="w-[1.4vw] h-[1.4vw] rounded-full bg-blue shadow-[0_4px_12px_rgba(47,91,255,0.4)]" />
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

        {/* PHASE 1 SUCCESS METRICS */}
        <motion.div
          className="mt-[8vh]"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.9 }}
        >
          <div className="flex items-baseline gap-[1.4vw] mb-[2.2vh]">
            <span className="font-display uppercase tracking-[0.3em] text-[0.72vw] text-red font-semibold whitespace-nowrap">
              Phase 1 Success Metrics
            </span>
            <span className="font-body italic text-[0.72vw] leading-[1.4] text-text/45">
              Phase 1 is not about awareness — it is about proving behavior,
              retention, and ecosystem engagement.
            </span>
          </div>
          <div className="grid grid-cols-4 gap-[2.5vw]">
            {KPIS.map((col, i) => (
              <motion.div
                key={col.t}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduce ? undefined : { duration: 0.45, ease: EASE, delay: 0.98 + i * 0.08 }
                }
              >
                <div
                  className={`font-display uppercase tracking-[0.22em] text-[0.66vw] font-semibold mb-[1.2vh] ${col.accent}`}
                >
                  {col.t}
                </div>
                <ul className="space-y-[0.7vh]">
                  {col.items.map((item) => (
                    <li
                      key={item}
                      className="flex gap-[0.5vw] font-body text-[0.78vw] leading-[1.35] text-text/65"
                    >
                      <span className="text-red leading-[1.35]">·</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </SlideFrame>
  );
}
