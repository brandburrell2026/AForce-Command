import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

const FACTS = [
  { k: "Founded", v: "2011" },
  { k: "Acquired by Coca-Cola", v: "2021" },
  { k: "Exit valuation", v: "$5.6B", blue: true },
  { k: "Early investor returns", v: "100×+", red: true },
];

const SCENARIO = [
  { in: "$25K", out: "$9.3M" },
  { in: "$50K", out: "$18.6M" },
  { in: "$100K", out: "$37.3M" },
];

export default function TheComparable() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={20}>
      <div className="absolute inset-0 flex flex-col px-[5vw] pt-[11vh] pb-[9vh]">
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
          className="font-display font-light tracking-[-0.025em] text-[3vw] leading-[1.02] text-text mt-[2.2vh]"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
        >
          BodyArmor proved <span className="text-red font-normal">the upside.</span>
        </motion.h1>
        <motion.p
          className="mt-[2vh] max-w-[52vw] font-body text-[1.0vw] leading-[1.5] text-text/65"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.18 }}
        >
          Founded in 2011 and acquired by Coca-Cola for $5.6 billion just ten years later. The
          premium hydration category creates massive value — and early investors captured it.
        </motion.p>

        {/* BODY — two columns */}
        <div className="flex-1 flex gap-[3vw] mt-[3.6vh] min-h-0">
          {/* LEFT — the story facts */}
          <div className="w-[46%] min-w-0 flex flex-col">
            <div className="font-display uppercase tracking-[0.22em] text-[0.66vw] text-text/45 font-medium mb-[1vh]">
              The success story
            </div>
            <div className="grid grid-cols-2 gap-x-[2.5vw] gap-y-[0.6vh]">
              {FACTS.map((f, i) => (
                <motion.div
                  key={f.k}
                  className="flex flex-col py-[1.4vh] border-b border-text/15"
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    reduce ? undefined : { duration: 0.45, ease: EASE, delay: 0.25 + i * 0.06 }
                  }
                >
                  <span
                    className={`font-display text-[2.2vw] leading-[1.0] tabular-nums ${
                      f.blue ? "text-blue" : f.red ? "text-red" : "text-text"
                    } ${f.blue || f.red ? "font-normal" : "font-light"}`}
                  >
                    {f.v}
                  </span>
                  <span className="font-display uppercase tracking-[0.14em] text-[0.62vw] text-text/50 font-medium mt-[0.6vh]">
                    {f.k}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* RIGHT — what it means for AForce investors */}
          <div className="w-[51%] min-w-0 flex flex-col">
            <motion.div
              className="flex-1 flex flex-col rounded-[0.6vw] bg-black px-[2vw] py-[2vh]"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.4 }}
            >
              <div className="font-display uppercase tracking-[0.22em] text-[0.62vw] text-bg/45 font-medium">
                If AForce reaches a $5.6B exit
              </div>
              <div className="flex-1 flex flex-col justify-center gap-[1.4vh] mt-[1.4vh]">
                {SCENARIO.map((s, i) => (
                  <motion.div
                    key={s.in}
                    className="flex items-center justify-between gap-[1.5vw] pb-[1.4vh] border-b border-bg/[0.1] last:border-0 last:pb-0"
                    initial={reduce ? false : { opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={
                      reduce ? undefined : { duration: 0.45, ease: EASE, delay: 0.5 + i * 0.08 }
                    }
                  >
                    <span className="font-display text-[1.3vw] font-light text-bg/70 tabular-nums leading-none">
                      {s.in}
                    </span>
                    <span aria-hidden className="flex-1 mx-[1vw] border-t border-dashed border-bg/20" />
                    <span className="font-display text-[2.6vw] font-light text-red tabular-nums leading-none">
                      {s.out}
                    </span>
                  </motion.div>
                ))}
              </div>
              <div className="font-display uppercase tracking-[0.18em] text-[0.56vw] text-bg/40 font-medium mt-[1.4vh]">
                Illustrative — based on a BodyArmor-scale outcome
              </div>
            </motion.div>
          </div>
        </div>
        <div className="mx-auto max-w-[70vw] text-center font-body italic text-[#aaa] text-[0.58vw] tracking-[0.05em] leading-[1.4] mt-[1.5vh]">
          BodyArmor figures are publicly reported third-party outcomes and are not a prediction of
          AForce results. All AForce return figures are illustrative and forward-looking. Past
          performance of comparable companies does not guarantee future results.
        </div>
      </div>
    </SlideFrame>
  );
}
