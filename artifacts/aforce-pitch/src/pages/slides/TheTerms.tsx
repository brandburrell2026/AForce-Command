import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

const TIERS = [
  { amount: "$25,000", equity: "0.125%" },
  { amount: "$50,000", equity: "0.25%" },
  { amount: "$100,000", equity: "0.50%" },
  { amount: "$200,000", equity: "1.00%" },
];

const COLS = [
  { amount: "$10K", equity: "0.05%" },
  { amount: "$25K", equity: "0.125%" },
  { amount: "$50K", equity: "0.25%" },
  { amount: "$100K", equity: "0.50%" },
];

const RETURNS: { exit: string; cells: string[] }[] = [
  { exit: "$100M", cells: ["$50K", "$125K", "$250K", "$500K"] },
  { exit: "$250M", cells: ["$125K", "$312K", "$625K", "$1.25M"] },
  { exit: "$500M", cells: ["$250K", "$625K", "$1.25M", "$2.5M"] },
  { exit: "$1B", cells: ["$500K", "$1.25M", "$2.5M", "$5M"] },
];

export default function TheTerms() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={16}>
      <div className="absolute inset-0 flex flex-col px-[5vw] pt-[11vh] pb-[9vh]">
        {/* HEADER */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
            The Terms
          </span>
        </motion.div>
        <motion.h1
          className="font-display font-light tracking-[-0.025em] text-[3vw] leading-[1.02] text-text mt-[2.2vh]"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
        >
          Friends &amp; family, at the <span className="text-red font-normal">ground floor.</span>
        </motion.h1>
        <div className="font-display uppercase tracking-[0.2em] text-[0.66vw] text-text/40 font-medium mt-[1vh]">
          SAFE · Minimum investment $25,000
        </div>

        {/* BODY — two columns */}
        <div className="flex-1 flex gap-[3vw] mt-[3.6vh] min-h-0">
          {/* LEFT — equity breakdown */}
          <div className="w-[40%] min-w-0 flex flex-col">
            <div className="font-display uppercase tracking-[0.22em] text-[0.66vw] text-text/45 font-medium mb-[2vh]">
              Equity breakdown
            </div>
            <div className="flex flex-col">
              {TIERS.map((t, i) => (
                <motion.div
                  key={t.amount}
                  className="flex items-baseline justify-between py-[1.6vh] border-b border-text/15"
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    reduce ? undefined : { duration: 0.45, ease: EASE, delay: 0.2 + i * 0.06 }
                  }
                >
                  <span className="font-display text-[1.7vw] font-light text-text tabular-nums leading-none">
                    {t.amount}
                  </span>
                  <span className="font-display text-[1.4vw] font-normal text-blue tabular-nums leading-none">
                    {t.equity}
                  </span>
                </motion.div>
              ))}
            </div>
            <motion.div
              className="mt-[2.4vh] rounded-[0.6vw] bg-text px-[1.4vw] py-[1.6vh] flex items-center justify-between"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.5 }}
            >
              <span className="font-display uppercase tracking-[0.2em] text-[0.6vw] text-bg/55 font-medium">
                Minimum
              </span>
              <span className="font-display text-[1.5vw] font-light text-bg tabular-nums leading-none">
                $25,000
              </span>
            </motion.div>
          </div>

          {/* RIGHT — projected returns matrix */}
          <div className="w-[57%] min-w-0 flex flex-col">
            <div className="font-display uppercase tracking-[0.22em] text-[0.66vw] text-text/45 font-medium mb-[2vh]">
              Projected investor returns
            </div>
            <div className="flex-1 flex flex-col">
              {/* header row */}
              <div className="grid grid-cols-[0.9fr_1fr_1fr_1fr_1fr] items-end pb-[1.2vh] border-b-2 border-text/25">
                <div className="font-display uppercase tracking-[0.16em] text-[0.6vw] text-text/45 font-medium">
                  Exit
                </div>
                {COLS.map((c) => (
                  <div key={c.amount} className="flex flex-col items-end">
                    <span className="font-display text-[0.95vw] font-normal text-text tabular-nums leading-none">
                      {c.amount}
                    </span>
                    <span className="font-display text-[0.56vw] text-text/45 tabular-nums mt-[0.4vh]">
                      {c.equity}
                    </span>
                  </div>
                ))}
              </div>
              {/* rows */}
              {RETURNS.map((r, i) => (
                <motion.div
                  key={r.exit}
                  className="grid grid-cols-[0.9fr_1fr_1fr_1fr_1fr] items-center py-[1.5vh] border-b border-text/12"
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    reduce ? undefined : { duration: 0.45, ease: EASE, delay: 0.3 + i * 0.07 }
                  }
                >
                  <span className="font-display text-[1.2vw] font-normal text-red tabular-nums leading-none">
                    {r.exit}
                  </span>
                  {r.cells.map((cell, j) => (
                    <span
                      key={j}
                      className={`text-right font-display text-[1.05vw] tabular-nums leading-none ${
                        j === r.cells.length - 1 ? "text-blue font-normal" : "text-text/80 font-light"
                      }`}
                    >
                      {cell}
                    </span>
                  ))}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-[70vw] text-center font-body italic text-[#aaa] text-[0.58vw] tracking-[0.05em] leading-[1.4] mt-[1.5vh]">
          All return figures are illustrative and forward-looking, shown gross of fees, taxes, and
          dilution. They assume the stated exit valuation is achieved. There is no guarantee of any
          return and investors may lose their entire investment.
        </div>
      </div>
    </SlideFrame>
  );
}
