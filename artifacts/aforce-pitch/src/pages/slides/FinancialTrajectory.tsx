import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Financial Trajectory — the phased revenue + EBITDA story. Three ascending
 * revenue years climaxing in 2028 scale + the first positive-EBITDA year, with
 * the proportional mini-bars conveying the trajectory at a glance. Colors follow
 * the deck tri-color system: red = the scale milestone (2028 revenue), blue =
 * durability / recurring economics (EBITDA), charcoal = the proving years.
 */
const KPIS = [
  {
    label: "2026 Revenue",
    num: "$185,000",
    unit: "",
    note: "Commercial launch and proof-of-concept phase",
    bar: 4,
    rule: "bg-text/45",
    value: "text-text",
    barColor: "bg-text/60",
    kind: "rev" as const,
  },
  {
    label: "2027 Revenue",
    num: "$2.36",
    unit: "Million",
    note: "Expansion of subscriptions, DTC, Amazon, and strategic channels",
    bar: 24,
    rule: "bg-text/45",
    value: "text-text",
    barColor: "bg-text",
    kind: "rev" as const,
  },
  {
    label: "2028 Revenue",
    num: "$9.83",
    unit: "Million",
    note: "Scaled customer acquisition and recurring revenue growth",
    bar: 100,
    rule: "bg-red",
    value: "text-red",
    barColor: "bg-red",
    kind: "rev" as const,
  },
  {
    label: "2028 EBITDA",
    num: "$1.17",
    unit: "Million",
    note: "Positive EBITDA driven by operating leverage and subscription economics",
    bar: 0,
    rule: "bg-blue",
    value: "text-blue",
    barColor: "bg-blue",
    kind: "ebitda" as const,
  },
];

const SUPPORT = [
  {
    label: "Gross Margin Target",
    value: "50%+",
    accent: "text-text",
  },
  {
    label: "Recurring Revenue Model",
    value: "Subscription + Membership + Commerce",
    accent: "text-text",
  },
  {
    label: "Capital Raised",
    value: "$832,000 SAFE Capital from 18 Investors",
    accent: "text-text",
  },
  {
    label: "Financing Request",
    value: "$4 Million Growth Facility",
    accent: "text-red",
  },
];

export default function FinancialTrajectory() {
  const reduce = useReducedMotion();

  const reveal = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 } as const,
    transition: reduce ? undefined : { duration: 0.5, ease: EASE, delay },
  });

  return (
    <SlideFrame slide={21}>
      <div className="absolute inset-0 flex flex-col px-[5vw] pt-[11vh] pb-[9vh]">
        {/* HEADER */}
        <motion.div {...reveal(0)}>
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
            Financial Trajectory
          </span>
        </motion.div>
        <motion.h1
          className="font-display font-light tracking-[-0.025em] text-[2.8vw] leading-[1.04] text-text mt-[2.2vh]"
          {...reveal(0.08)}
        >
          Building a scalable and{" "}
          <span className="text-red font-normal">profitable</span> performance
          platform.
        </motion.h1>
        <motion.p
          className="mt-[1.4vh] max-w-[60vw] font-body text-[0.92vw] leading-[1.55] text-text/55"
          {...reveal(0.16)}
        >
          Projected financial performance reflects a phased commercialization
          strategy focused on proof, retention, recurring revenue, and
          operational leverage.
        </motion.p>

        {/* FOUR LARGE KPI PANELS */}
        <div className="mt-[3.4vh] grid grid-cols-4 gap-[1.4vw]">
          {KPIS.map((k, i) => (
            <motion.div
              key={k.label}
              className="flex flex-col rounded-[0.7vw] border border-text/12 bg-text/[0.025] px-[1.4vw] py-[2vh]"
              {...reveal(0.24 + i * 0.07)}
            >
              <span
                className={`block h-[3px] w-[2.4vw] rounded-full ${k.rule} mb-[1.6vh]`}
              />
              <span className="font-display uppercase tracking-[0.18em] text-[0.66vw] text-text/50 font-medium">
                {k.label}
              </span>
              <div className="mt-[0.6vh] flex items-baseline gap-[0.4vw]">
                <span
                  className={`font-display font-light leading-[1.0] tabular-nums text-[2.5vw] ${k.value}`}
                >
                  {k.num}
                </span>
                {k.unit ? (
                  <span
                    className={`font-display font-normal text-[1.02vw] leading-none ${k.value}`}
                  >
                    {k.unit}
                  </span>
                ) : null}
              </div>

              {k.kind === "rev" ? (
                <div className="mt-[1.4vh] h-[0.7vh] w-full rounded-full bg-text/10 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${k.barColor}`}
                    style={{ width: `${Math.max(k.bar, 4)}%`, transformOrigin: "left" }}
                    initial={reduce ? false : { scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={
                      reduce
                        ? undefined
                        : { duration: 0.75, ease: EASE, delay: 0.4 + i * 0.07 }
                    }
                  />
                </div>
              ) : (
                <div className="mt-[1.4vh]">
                  <span className="inline-flex w-fit items-center font-display uppercase tracking-[0.18em] text-[0.55vw] text-blue font-semibold border border-blue/45 rounded-full px-[0.7vw] py-[0.35vh]">
                    Positive EBITDA
                  </span>
                </div>
              )}

              <p className="mt-[1.4vh] font-body text-[0.66vw] leading-[1.4] text-text/50">
                {k.note}
              </p>
            </motion.div>
          ))}
        </div>

        {/* ADDITIONAL KPI STRIP */}
        <div className="mt-[3vh] grid grid-cols-4 border-t border-text/15 pt-[2.2vh]">
          {SUPPORT.map((s, i) => (
            <motion.div
              key={s.label}
              className={`flex flex-col px-[1.4vw] ${
                i > 0 ? "border-l border-text/12" : ""
              }`}
              {...reveal(0.55 + i * 0.06)}
            >
              <span className="font-display uppercase tracking-[0.16em] text-[0.62vw] text-text/45 font-medium">
                {s.label}
              </span>
              <span
                className={`mt-[0.7vh] font-display font-normal text-[1.06vw] leading-[1.3] ${s.accent}`}
              >
                {s.value}
              </span>
            </motion.div>
          ))}
        </div>

        {/* BOTTOM STATEMENT */}
        <motion.div className="mt-auto pt-[2.4vh]" {...reveal(0.82)}>
          <div className="mx-auto max-w-[64vw] text-center">
            <span className="block h-[2px] w-[3vw] rounded-full bg-red mx-auto mb-[1.4vh]" />
            <p className="font-display text-[1.06vw] font-medium tracking-[-0.01em] leading-[1.45] text-text">
              Designed to demonstrate a credible path from commercialization to
              positive EBITDA while building a{" "}
              <span className="text-blue">durable recurring revenue platform.</span>
            </p>
            <p className="mt-[1.1vh] font-body italic text-[0.58vw] tracking-[0.05em] leading-[1.4] text-[#aaa]">
              Projections are illustrative and forward-looking; actual results may
              vary materially.
            </p>
          </div>
        </motion.div>
      </div>
    </SlideFrame>
  );
}
