import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";
import ProjectionDisclaimer from "@/components/ProjectionDisclaimer";

const EASE = [0.16, 1, 0.3, 1] as const;

type Row = { invest: string; stake: string; y3: string; y5: string };

const ROWS: Row[] = [
  { invest: "$25K", stake: "0.125%", y3: "$456K+", y5: "$1.25M+" },
  { invest: "$50K", stake: "0.25%", y3: "$912K+", y5: "$2.5M+" },
  { invest: "$100K", stake: "0.50%", y3: "$1.8M+", y5: "$5M+" },
];

export default function ProjectedReturns() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={22}>
      {/* cool accent halo, upper-right — financial upside */}
      <div
        aria-hidden
        className="absolute right-[-6vw] top-[6vh] h-[44vh] w-[44vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(47,91,255,0.10) 0%, rgba(47,91,255,0) 70%)",
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
            The Return
          </span>
        </motion.div>
        <motion.h1
          className="font-display font-light tracking-[-0.025em] text-[2.9vw] leading-[1.02] text-text mt-[2.4vh]"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
        >
          Projected investor <span className="text-blue font-normal">returns.</span>
        </motion.h1>
        <div className="font-display uppercase tracking-[0.2em] text-[0.66vw] text-text/40 font-medium mt-[1.2vh]">
          Illustrative · Based on a 0.125%–0.50% stake at this round
        </div>

        {/* TABLE */}
        <div className="mt-[4vh]">
          {/* header row */}
          <div className="grid grid-cols-[1.6fr_1fr_1fr] items-end border-b-2 border-red pb-[1.3vh]">
            <span className="font-display uppercase tracking-[0.24em] text-[0.72vw] text-text/55 font-semibold">
              Investment
            </span>
            <span className="text-right font-display uppercase tracking-[0.22em] text-[0.72vw] text-text/55 font-semibold">
              Year 3 · Est. Value
            </span>
            <span className="text-right font-display uppercase tracking-[0.22em] text-[0.72vw] text-blue font-semibold">
              Year 5 · Est. Value
            </span>
          </div>

          {/* data rows */}
          {ROWS.map((r, i) => (
            <motion.div
              key={r.invest}
              className="grid grid-cols-[1.6fr_1fr_1fr] items-baseline border-b border-text/12 py-[2vh]"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.25 + i * 0.1 }
              }
            >
              <span className="flex items-baseline gap-[0.8vw]">
                <span className="font-display text-[2.4vw] font-light text-text tabular-nums leading-none">
                  {r.invest}
                </span>
                <span className="font-display uppercase tracking-[0.12em] text-[0.72vw] text-text/45 font-medium">
                  {r.stake}
                </span>
              </span>
              <span className="text-right font-display text-[2.2vw] font-light text-text tabular-nums leading-none">
                {r.y3}
              </span>
              <span className="text-right font-display text-[2.2vw] font-normal text-blue tabular-nums leading-none">
                {r.y5}
              </span>
            </motion.div>
          ))}
        </div>

        {/* CALLOUT — the shape of the return */}
        <motion.div
          className="mt-auto flex items-center justify-between gap-[3vw] rounded-[0.6vw] bg-text px-[2.2vw] py-[2.2vh]"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.6 }}
        >
          <div className="flex flex-col">
            <span className="font-display uppercase tracking-[0.24em] text-[0.6vw] text-bg/45 font-semibold">
              The shape of the return
            </span>
            <span className="mt-[0.7vh] font-display font-light text-[1.15vw] leading-[1.25] text-bg">
              The same multiple holds at every check size.
            </span>
          </div>
          <div className="flex items-stretch gap-[2vw]">
            <div className="flex flex-col items-end">
              <span className="font-display font-light text-[2vw] tabular-nums leading-none text-bg">
                ≈18×
              </span>
              <span className="mt-[0.5vh] font-display uppercase tracking-[0.2em] text-[0.56vw] text-bg/45 font-semibold">
                By Year 3
              </span>
            </div>
            <span className="w-px self-stretch bg-bg/15" aria-hidden />
            <div className="flex flex-col items-end">
              <span className="font-display font-normal text-[2vw] tabular-nums leading-none text-blue">
                ≈50×
              </span>
              <span className="mt-[0.5vh] font-display uppercase tracking-[0.2em] text-[0.56vw] text-bg/45 font-semibold">
                By Year 5
              </span>
            </div>
          </div>
        </motion.div>

        {/* disclaimer */}
        <ProjectionDisclaimer className="mx-auto max-w-[70vw] text-center mt-[1.6vh]" />
      </div>
    </SlideFrame>
  );
}
