import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

const COMPS = [
  { name: "Prime", v: "$250M+", note: "Revenue in year one", tone: "red" as const },
  { name: "Liquid I.V.", v: "$500M", note: "Acquired by Unilever", tone: "blue" as const },
  { name: "BodyArmor", v: "$5.6B", note: "Acquired by Coca-Cola", tone: "blue" as const },
  { name: "Oatly", v: "$10B+", note: "IPO valuation", tone: "blue" as const },
];

export default function TheExit() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={21}>
      <div className="absolute inset-0 flex flex-col px-[5vw] pt-[10vh] pb-[8.5vh]">
        {/* HEADER */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
            The Exit
          </span>
        </motion.div>
        <motion.h1
          className="font-display font-light tracking-[-0.025em] text-[3vw] leading-[1.02] text-text mt-[2.2vh]"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
        >
          A prime <span className="text-red font-normal">acquisition target.</span>
        </motion.h1>
        <motion.p
          className="mt-[1.8vh] max-w-[54vw] font-body text-[1.0vw] leading-[1.5] text-text/65"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.18 }}
        >
          Strategic acquirers pay premiums for brands that own a behavior. The premium hydration
          category has produced repeated billion-dollar outcomes.
        </motion.p>

        {/* COMP GRID + AFORCE */}
        <div className="flex-1 grid grid-cols-5 gap-[1.3vw] mt-[3.6vh] min-h-0">
          {COMPS.map((c, i) => (
            <motion.div
              key={c.name}
              className="flex flex-col justify-between rounded-[0.6vw] border border-text/15 px-[1.3vw] py-[2.4vh]"
              initial={reduce ? false : { opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.3 + i * 0.08 }}
            >
              <div className="flex flex-col">
                <span className="font-display uppercase tracking-[0.2em] text-[0.62vw] text-text/50 font-semibold">
                  {c.name}
                </span>
                <span className="mt-[1vh] mb-[1.6vh] h-px w-full bg-text/12" />
                <span
                  className={`font-display text-[2.5vw] font-normal leading-[1.0] tabular-nums ${
                    c.tone === "blue" ? "text-blue" : "text-red"
                  }`}
                >
                  {c.v}
                </span>
              </div>
              <span className="font-body text-[0.72vw] text-text/55 leading-[1.4]">{c.note}</span>
            </motion.div>
          ))}

          {/* AFORCE — the next name */}
          <motion.div
            className="relative flex flex-col justify-between overflow-hidden rounded-[0.6vw] bg-black px-[1.3vw] py-[2.4vh]"
            initial={reduce ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.3 + COMPS.length * 0.08 }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(80% 70% at 50% 18%, rgba(228,30,43,0.28) 0%, rgba(228,30,43,0) 72%)",
              }}
            />
            <div className="relative flex flex-col">
              <span className="font-display uppercase tracking-[0.2em] text-[0.62vw] text-red font-semibold">
                AForce
              </span>
              <span className="mt-[1vh] mb-[1.6vh] h-px w-full bg-cream/15" />
              <span className="font-display text-[2.5vw] font-light leading-[1.0] text-cream">
                Next.
              </span>
            </div>
            <span className="relative font-body text-[0.72vw] text-cream/60 leading-[1.4]">
              Built to become the next name on this list.
            </span>
          </motion.div>
        </div>

        <div className="mx-auto max-w-[70vw] text-center font-body italic text-text/40 text-[0.58vw] tracking-[0.05em] leading-[1.4] mt-[3vh]">
          Comparable-company figures are publicly reported third-party outcomes shown for context
          only. They are not a prediction or guarantee of any AForce outcome.
        </div>
      </div>
    </SlideFrame>
  );
}
