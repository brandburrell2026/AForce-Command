import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

const TIMELINE = [
  {
    year: "2026",
    items: ["Retail launch", "Strategic distribution expansion", "National awareness campaign"],
  },
  {
    year: "2027",
    items: [
      "Major retail growth",
      "Multi-state expansion",
      "Revenue acceleration",
      "Institutional financing discussions",
    ],
  },
  {
    year: "2028",
    items: [
      "National footprint",
      "Expanded product portfolio",
      "Strategic partnerships",
      "Potential acquisition or growth financing",
    ],
  },
];

const LADDER = [
  "Friends & Family Round",
  "Retail Expansion",
  "Revenue Growth",
  "Institutional Capital",
  "Strategic Exit Opportunities",
];

export default function RoadmapToValuation() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={19}>
      <div className="absolute inset-0 flex flex-col px-[5vw] pt-[11vh] pb-[9vh]">
        {/* HEADER */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
            Roadmap
          </span>
        </motion.div>
        <motion.h1
          className="font-display font-light tracking-[-0.025em] text-[3vw] leading-[1.02] text-text mt-[2.2vh]"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
        >
          Roadmap to the <span className="text-red font-normal">next valuation.</span>
        </motion.h1>
        <motion.p
          className="mt-[2vh] max-w-[54vw] font-body text-[1.0vw] leading-[1.5] text-text/65"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.18 }}
        >
          The next 24 months are focused on scaling distribution, revenue, and enterprise value.
        </motion.p>

        {/* TIMELINE */}
        <div className="grid grid-cols-3 gap-[2.4vw] mt-[3.6vh]">
          {TIMELINE.map((t, i) => (
            <motion.div
              key={t.year}
              className="flex flex-col border-t-2 border-text/20 pt-[1.6vh]"
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.3 + i * 0.1 }}
            >
              <span className="font-display text-[2vw] font-light text-text tabular-nums leading-none">
                {t.year}
              </span>
              <div className="flex flex-col gap-[0.8vh] mt-[1.6vh]">
                {t.items.map((it) => (
                  <div key={it} className="flex items-baseline gap-[0.6vw]">
                    <span className="h-[0.35vw] w-[0.35vw] rounded-full bg-red shrink-0 translate-y-[-0.2vh]" />
                    <span className="font-body text-[0.82vw] text-text/70 leading-[1.35]">{it}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* VALUE CREATION LADDER */}
        <motion.div
          className="flex-1 flex flex-col justify-center mt-[2.4vh] min-h-0"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.7 }}
        >
          <span className="font-display uppercase tracking-[0.22em] text-[0.62vw] text-text/45 font-medium mb-[1.4vh]">
            Value creation ladder
          </span>
          <div className="flex items-stretch gap-[0.7vw]">
            {LADDER.map((step, i) => (
              <div key={step} className="flex items-center gap-[0.7vw] flex-1">
                <div
                  className={`flex-1 flex items-center justify-center text-center rounded-[0.4vw] px-[0.8vw] py-[1.8vh] ${
                    i === LADDER.length - 1 ? "bg-red" : "bg-black"
                  }`}
                >
                  <span
                    className={`font-display uppercase tracking-[0.08em] text-[0.66vw] font-semibold leading-[1.25] ${
                      i === LADDER.length - 1 ? "text-bg" : "text-bg/85"
                    }`}
                  >
                    {step}
                  </span>
                </div>
                {i < LADDER.length - 1 && (
                  <span className="font-display text-[1.1vw] text-text/35 shrink-0">→</span>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        <div className="mx-auto max-w-[64vw] text-center font-display text-[1.0vw] font-light text-text/75 leading-[1.4] mt-[2.2vh]">
          The objective is simple: build enterprise value through{" "}
          <span className="text-red font-normal">disciplined execution and scalable growth.</span>
        </div>
      </div>
    </SlideFrame>
  );
}
