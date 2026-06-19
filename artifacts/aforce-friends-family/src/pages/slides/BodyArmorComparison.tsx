import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

type Row = { invest: string; stake: string; ret: string };

const ROWS: Row[] = [
  { invest: "$25K", stake: "0.125%", ret: "$7M+" },
  { invest: "$50K", stake: "0.25%", ret: "$14M+" },
  { invest: "$100K", stake: "0.50%", ret: "$28M+" },
];

const FACTS = [
  "Founded in 2011 — built the modern sports-hydration category from nothing.",
  "Early backers saw their stake multiply many times over at exit.",
];

export default function BodyArmorComparison() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={23}>
      {/* warm accent halo, lower-left — the exit */}
      <div
        aria-hidden
        className="absolute left-[-8vw] bottom-[-10vh] h-[50vh] w-[50vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(228,30,43,0.12) 0%, rgba(228,30,43,0) 68%)",
          filter: "blur(6px)",
        }}
      />

      <div className="absolute inset-0 flex flex-col px-[5vw] pt-[11vh] pb-[8vh]">
        {/* HEADER */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
            The Comparable
          </span>
        </motion.div>
        <motion.h1
          className="font-display font-light tracking-[-0.025em] text-[2.9vw] leading-[1.02] text-text mt-[2.4vh]"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
        >
          What a similar <span className="text-red font-normal">exit</span> would return.
        </motion.h1>
        <div className="font-display uppercase tracking-[0.2em] text-[0.66vw] text-text/40 font-medium mt-[1.2vh]">
          If AForce achieves a BodyArmor-scale outcome
        </div>

        {/* BODY — two columns */}
        <div className="flex-1 flex gap-[4vw] mt-[4vh] min-h-0">
          {/* LEFT — BodyArmor's story */}
          <motion.div
            className="w-[44%] flex flex-col justify-center"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.2 }}
          >
            <span className="font-display uppercase tracking-[0.24em] text-[0.68vw] text-text/45 font-semibold">
              BodyArmor's success story
            </span>
            <div className="mt-[1.6vh] font-display font-light tabular-nums leading-none text-[4.6vw] text-red">
              $5.6B
            </div>
            <div className="mt-[1.4vh] font-display tracking-[-0.01em] text-[1.3vw] leading-[1.2] text-text">
              Acquired by Coca-Cola, 2021.
            </div>
            <div className="mt-[3vh] flex flex-col gap-[1.6vh] border-t border-text/15 pt-[2.4vh]">
              {FACTS.map((f) => (
                <div
                  key={f}
                  className="flex items-baseline gap-[0.8vw] font-body text-[0.92vw] leading-[1.5] text-text/65"
                >
                  <span className="mt-[0.55vh] h-[0.32vw] w-[0.32vw] shrink-0 rounded-full bg-red" />
                  {f}
                </div>
              ))}
            </div>
          </motion.div>

          {/* divider */}
          <div aria-hidden className="self-stretch w-px bg-text/12 my-[1vh]" />

          {/* RIGHT — return at a $5.6B exit */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="grid grid-cols-[1.3fr_1fr] items-end border-b-2 border-red pb-[1.3vh]">
              <span className="font-display uppercase tracking-[0.24em] text-[0.72vw] text-text/55 font-semibold">
                Investment
              </span>
              <span className="text-right font-display uppercase tracking-[0.22em] text-[0.72vw] text-red font-semibold">
                Return at $5.6B exit
              </span>
            </div>

            {ROWS.map((r, i) => (
              <motion.div
                key={r.invest}
                className="grid grid-cols-[1.3fr_1fr] items-baseline border-b border-text/12 py-[2.2vh]"
                initial={reduce ? false : { opacity: 0, x: 22 }}
                animate={{ opacity: 1, x: 0 }}
                transition={
                  reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.35 + i * 0.1 }
                }
              >
                <span className="flex items-baseline gap-[0.8vw]">
                  <span className="font-display text-[2.2vw] font-light text-text tabular-nums leading-none">
                    {r.invest}
                  </span>
                  <span className="font-display uppercase tracking-[0.12em] text-[0.7vw] text-text/45 font-medium">
                    {r.stake}
                  </span>
                </span>
                <span className="text-right font-display text-[2.6vw] font-normal text-red tabular-nums leading-none">
                  {r.ret}
                </span>
              </motion.div>
            ))}

            <div className="mt-[1.6vh] font-display uppercase tracking-[0.18em] text-[0.6vw] text-text/40 font-medium">
              Based on a 0.125%–0.50% stake at this round
            </div>
          </div>
        </div>

        {/* disclaimer */}
        <div className="mx-auto max-w-[72vw] text-center font-body italic text-[#aaa] text-[0.58vw] tracking-[0.05em] leading-[1.4] mt-[1.4vh]">
          BodyArmor figures are publicly reported. The AForce return scenario is a purely
          illustrative, forward-looking hypothetical and is not a forecast, promise, or
          guarantee of any outcome. Comparable-company outcomes do not predict AForce results.
        </div>
      </div>
    </SlideFrame>
  );
}
