import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

const STATS = [
  { k: "CAC Target", v: "$32", note: "Stop / pivot at $50", red: true },
  {
    k: "LTV",
    v: "$952",
    note: "$119/mo · 8 mo avg",
    subnote: "Based on comparable subscription wellness brands · conservative benchmark",
    blue: true,
  },
  { k: "LTV : CAC", v: "29.8×", note: "At $32 CAC", hero: true, blue: true },
  { k: "Sub Conversion", v: "20%+", note: "Of first purchases" },
];

const MARGINS = [
  { k: "Cans", v: "67%", note: "$1.65 COGS · $5 retail" },
  { k: "Sticks", v: "80%", note: "$0.69 COGS · $3.50 retail" },
  { k: "Sub Blended", v: "49%", note: "$60 COGS · $119 price" },
];

const BARS = [
  { k: "OS Advanced", v: 95, fill: "bg-red" },
  { k: "Sticks single", v: 80, fill: "bg-text" },
  { k: "Cans single", v: 67, fill: "bg-text/70" },
  { k: "Starter bundle", v: 58, fill: "bg-text/35" },
  { k: "Full subscription bundle", v: 49, fill: "bg-red/60" },
];

const SNAPSHOT = [
  { k: "Total customers", v: "1,200" },
  { k: "Active subscribers", v: "144", blue: true, strong: true },
  { k: "Monthly sub rev", v: "$17,136", blue: true },
  { k: "ARR run rate", v: "$205K", blue: true, strong: true },
  { k: "Repeat rate", v: "30%" },
  { k: "NPS target", v: "55+", red: true },
];

export default function TheEconomics() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={14}>
      <div className="absolute inset-0 flex flex-col px-[5vw] pt-[11vh] pb-[9vh]">
        {/* HEADER */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
            The Economics
          </span>
        </motion.div>
        <motion.h1
          className="font-display font-light tracking-[-0.025em] text-[3vw] leading-[1.02] text-text mt-[2.2vh]"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
        >
          Behavior compounds <span className="text-red font-normal">into revenue.</span>
        </motion.h1>
        <div className="font-display uppercase tracking-[0.2em] text-[0.66vw] text-text/40 font-medium mt-[1vh]">
          Unit economics · Real numbers · Based on actual vendor quotes
        </div>

        {/* BODY — two columns */}
        <div className="flex-1 flex gap-[3vw] mt-[3.2vh] min-h-0">
          {/* LEFT */}
          <div className="w-[54%] min-w-0 flex flex-col">
            {/* 2x2 stat grid */}
            <div className="grid grid-cols-2 gap-x-[2.5vw] gap-y-[1.4vh]">
              {STATS.map((s, i) => (
                <motion.div
                  key={s.k}
                  className={`flex flex-col py-[1.2vh] border-b ${
                    s.hero ? "border-red/60" : "border-text/15"
                  }`}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    reduce ? undefined : { duration: 0.45, ease: EASE, delay: 0.2 + i * 0.06 }
                  }
                >
                  <span className="font-display uppercase tracking-[0.16em] text-[0.66vw] text-text/50 font-medium">
                    {s.k}
                  </span>
                  <span
                    className={`font-display text-[2.4vw] leading-[1.05] tabular-nums ${
                      s.blue ? "text-blue" : s.hero || s.red ? "text-red" : "text-text"
                    } ${s.hero || s.red ? "font-normal" : "font-light"}`}
                  >
                    {s.v}
                  </span>
                  <span className="font-body text-[0.66vw] text-text/45 leading-[1.3] mt-[0.3vh]">
                    {s.note}
                  </span>
                  {s.subnote ? (
                    <span className="font-body italic text-[0.56vw] tracking-[0.05em] text-[#999] leading-[1.3] mt-[0.2vh]">
                      {s.subnote}
                    </span>
                  ) : null}
                </motion.div>
              ))}
            </div>

            {/* margin boxes */}
            <div className="grid grid-cols-3 gap-[1vw] mt-[2.4vh]">
              {MARGINS.map((m, i) => (
                <motion.div
                  key={m.k}
                  className="flex flex-col px-[1vw] py-[1.2vh] rounded-[0.5vw] bg-text/[0.04]"
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    reduce ? undefined : { duration: 0.45, ease: EASE, delay: 0.3 + i * 0.05 }
                  }
                >
                  <span className="font-display uppercase tracking-[0.14em] text-[0.6vw] text-text/45 font-medium">
                    {m.k}
                  </span>
                  <span className="font-display text-[1.7vw] font-light text-text tabular-nums leading-[1.1]">
                    {m.v}
                  </span>
                  <span className="font-body text-[0.58vw] text-text/40 leading-[1.25] mt-[0.2vh]">
                    {m.note}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* subscription tiers */}
            <div className="grid grid-cols-2 gap-[1.2vw] mt-[2.4vh]">
              <motion.div
                className="flex flex-col rounded-[0.6vw] border border-text/15 px-[1.2vw] py-[1.4vh]"
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.4 }}
              >
                <span className="font-display uppercase tracking-[0.2em] text-[0.58vw] text-text/45 font-semibold">
                  Starter
                </span>
                <span className="font-display text-[1.7vw] font-light text-text leading-[1.1] mt-[0.4vh]">
                  $49<span className="text-[0.8vw] text-text/50">/mo</span>
                </span>
                <div className="font-body text-[0.64vw] text-text/55 leading-[1.5] mt-[0.8vh]">
                  30 sticks/mo · OS Sport access · Entry ritual bundle
                </div>
                <div className="font-display text-[0.58vw] text-text/60 leading-[1.4] mt-[0.8vh] font-semibold uppercase tracking-[0.12em]">
                  58% margin
                </div>
                <div className="font-body text-[0.58vw] text-text/40 leading-[1.4] mt-[0.6vh]">
                  Upsell to full system at day 30
                </div>
              </motion.div>

              <motion.div
                className="flex flex-col rounded-[0.6vw] bg-black px-[1.2vw] py-[1.4vh]"
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.46 }}
              >
                <span className="inline-flex w-fit font-display uppercase tracking-[0.2em] text-[0.55vw] text-bg font-semibold bg-red rounded-full px-[0.6vw] py-[0.3vh]">
                  Full System
                </span>
                <span className="font-display text-[1.7vw] font-light text-bg leading-[1.1] mt-[0.5vh]">
                  $119<span className="text-[0.8vw] text-bg/50">/mo</span>
                </span>
                <div className="font-body text-[0.64vw] text-bg/70 leading-[1.5] mt-[0.8vh]">
                  24 cans + 30 sticks/mo · OS Advanced access · $225 retail value
                </div>
                <div className="font-body text-[0.58vw] text-red leading-[1.4] mt-[0.8vh] font-semibold">
                  47% off standalone retail
                </div>
              </motion.div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="w-[43%] min-w-0 flex flex-col">
            {/* gross margin bars */}
            <div>
              <div className="font-display uppercase tracking-[0.22em] text-[0.66vw] text-text/45 font-medium mb-[1.8vh]">
                Gross margin by product
              </div>
              <div className="flex flex-col gap-[1.5vh]">
                {BARS.map((b, i) => (
                  <motion.div
                    key={b.k}
                    initial={reduce ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      reduce ? undefined : { duration: 0.45, ease: EASE, delay: 0.3 + i * 0.05 }
                    }
                  >
                    <div className="flex items-baseline justify-between mb-[0.5vh]">
                      <span className="font-body text-[0.66vw] text-text/60 leading-none">
                        {b.k}
                      </span>
                      <span className="font-display text-[0.78vw] text-text font-normal tabular-nums leading-none">
                        {b.v}%
                      </span>
                    </div>
                    <div className="h-[1.1vh] w-full rounded-full bg-text/10 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${b.fill}`}
                        style={{ width: `${b.v}%`, transformOrigin: "left" }}
                        initial={reduce ? false : { scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={
                          reduce
                            ? undefined
                            : { duration: 0.7, ease: EASE, delay: 0.36 + i * 0.05 }
                        }
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* October snapshot */}
            <motion.div
              className="mt-[3vh] rounded-[0.6vw] bg-text px-[1.6vw] py-[1.8vh]"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.55 }}
            >
              <div className="flex items-center gap-[0.7vw] mb-[1.4vh]">
                <span className="font-display uppercase tracking-[0.22em] text-[0.6vw] text-bg/45 font-medium">
                  Projected
                </span>
                <span className="text-bg/20 text-[0.6vw] leading-none">·</span>
                <span className="font-display uppercase tracking-[0.22em] text-[0.6vw] text-bg/45 font-medium">
                  October snapshot
                </span>
              </div>
              <div className="grid grid-cols-3 gap-x-[1.5vw] gap-y-[1.6vh]">
                {SNAPSHOT.map((s) => (
                  <div key={s.k} className="flex flex-col">
                    <span
                      className={`font-display text-[1.4vw] leading-[1.05] tabular-nums ${
                        s.blue ? "text-blue" : s.red ? "text-red" : "text-bg"
                      } ${s.red || s.strong ? "font-normal" : "font-light"}`}
                    >
                      {s.v}
                    </span>
                    <span className="font-display uppercase tracking-[0.1em] text-[0.55vw] text-bg/45 font-medium mt-[0.3vh]">
                      {s.k}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-[1.6vh] pt-[1.4vh] border-t border-bg/[0.08] flex items-center justify-center gap-[1.6vw]">
                <div className="flex flex-col items-center">
                  <span className="font-display uppercase tracking-[0.2em] text-[0.55vw] text-bg/40 font-medium">
                    Monthly Burn
                  </span>
                  <span className="font-display text-[1vw] font-semibold text-bg tabular-nums leading-[1.1] mt-[0.3vh]">
                    ~$150K
                  </span>
                </div>
                <span className="text-bg/25 text-[1vw] leading-none">|</span>
                <div className="flex flex-col items-center">
                  <span className="font-display uppercase tracking-[0.2em] text-[0.55vw] text-bg/40 font-medium">
                    Runway on $4M
                  </span>
                  <span className="font-display text-[1vw] font-semibold text-bg tabular-nums leading-[1.1] mt-[0.3vh]">
                    26 months
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
        <div className="mx-auto max-w-[70vw] text-center font-body italic text-[#aaa] text-[0.58vw] tracking-[0.05em] leading-[1.4] mt-[1.5vh]">
          All financial projections are illustrative and forward-looking. Unit economics
          based on actual vendor quotes from iLabs (March 2026) and Bev-Hub (2026).
          Subscription retention benchmarks based on comparable wellness brands. Actual
          results may vary materially.
        </div>
      </div>
    </SlideFrame>
  );
}
