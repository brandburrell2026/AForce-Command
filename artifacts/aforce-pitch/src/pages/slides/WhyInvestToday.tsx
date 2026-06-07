import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

const PILLARS = [
  {
    n: "01",
    title: "Patent-Protected Technology",
    body: "Multiple patents filed supporting long-term defensibility.",
  },
  {
    n: "02",
    title: "National Retail Rollout",
    body: "Launch strategy focused on premium retail and strategic distribution.",
  },
  {
    n: "03",
    title: "Media Momentum",
    body: "Featured on Season 2 of America's Real Deal on Amazon Prime.",
  },
  {
    n: "04",
    title: "Massive Market",
    body: "Hydration, performance, and wellness represent tens of billions in annual consumer spending.",
  },
];

export default function WhyInvestToday() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={17}>
      <div className="absolute inset-0 flex flex-col px-[5vw] pt-[11vh] pb-[9vh]">
        {/* HEADER */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
            Why Invest Today
          </span>
        </motion.div>
        <motion.h1
          className="font-display font-light tracking-[-0.025em] text-[3vw] leading-[1.02] text-text mt-[2.2vh]"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
        >
          Why invest <span className="text-red font-normal">today.</span>
        </motion.h1>
        <motion.p
          className="mt-[2vh] max-w-[54vw] font-body text-[1.0vw] leading-[1.5] text-text/65"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.18 }}
        >
          Friends &amp; Family investors enter before institutional capital.
        </motion.p>

        {/* FOUR PILLARS */}
        <div className="grid grid-cols-4 gap-[1.6vw] mt-[3.8vh]">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.n}
              className="flex flex-col border-t-2 border-text/20 pt-[1.8vh]"
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.3 + i * 0.08 }}
            >
              <span className="font-display text-[1.3vw] font-light text-red tabular-nums leading-none">
                {p.n}
              </span>
              <span className="font-display text-[1.15vw] font-normal text-text leading-[1.15] mt-[1.6vh]">
                {p.title}
              </span>
              <span className="font-body text-[0.8vw] text-text/60 leading-[1.45] mt-[1.2vh]">
                {p.body}
              </span>
            </motion.div>
          ))}
        </div>

        {/* HIGHLIGHTED STATEMENT */}
        <motion.div
          className="flex items-center gap-[1.6vw] rounded-[0.6vw] bg-black px-[2.4vw] py-[2.4vh] mt-[auto] mb-[1vh]"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.66 }}
        >
          <span className="h-[2.4vw] w-[3px] bg-red shrink-0" />
          <span className="font-display text-[1.35vw] font-light text-bg leading-[1.25]">
            Current investors enter at the earliest stage — before significant{" "}
            <span className="text-red font-normal">valuation expansion.</span>
          </span>
        </motion.div>

        <div className="mx-auto max-w-[62vw] text-center font-display text-[1.0vw] font-light text-text/75 leading-[1.4] mt-[1.6vh]">
          The greatest returns are often created before the market recognizes the opportunity.
        </div>
      </div>
    </SlideFrame>
  );
}
