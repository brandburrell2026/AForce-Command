import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

const USE = [
  {
    pct: 35,
    label: "Product & Inventory",
    sub: "Launch SKUs + concierge stock",
    amount: "$1,400,000",
    bar: "bg-red",
  },
  {
    pct: 25,
    label: "Marketing & Activation",
    sub: "Brickell + NYC density, event, paid acquisition",
    amount: "$1,000,000",
    bar: "bg-text",
  },
  {
    pct: 25,
    label: "Tech & OS Development",
    sub: "AForce OS build, app, retention infrastructure",
    amount: "$1,000,000",
    bar: "bg-blue",
  },
  {
    pct: 15,
    label: "Team & Operations",
    sub: "Salaries, legal, insurance, overhead · ~$50K/mo",
    amount: "$600,000",
    bar: "bg-text/30",
  },
];

export default function TheAsk() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={14}>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-[5vw] pt-[9vh] pb-[9vh] text-center">
        <motion.div
          className="mb-[1.6vh]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold">
            The Ask
          </span>
        </motion.div>

        {/* $4M — the single dominant element */}
        <motion.div
          className="font-display font-normal tracking-[0.005em] text-[8vw] leading-[0.84] text-text"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.7, ease: EASE, delay: 0.08 }}
        >
          $4<span className="text-red">M</span>
        </motion.div>
        <motion.p
          className="mt-[1.6vh] max-w-[36vw] font-body text-[1.05vw] leading-[1.5] text-text/65"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.28 }}
        >
          A proof-of-concept raise. This capital funds proof of habit. The next
          round funds scale.
        </motion.p>

        {/* use of funds — four full-width allocation bars */}
        <div className="mt-[2.6vh] w-full max-w-[62vw] text-left">
          <div className="inline-block font-display uppercase tracking-[0.22em] text-[0.68vw] text-text/45 font-semibold mb-[1.6vh] border-b-2 border-red pb-[0.7vh]">
            Use of funds
          </div>

          <div className="flex flex-col gap-[1.4vh]">
            {USE.map((u, i) => (
              <motion.div
                key={u.label}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.3 + i * 0.08 }
                }
              >
                <div className="flex items-baseline justify-between mb-[0.9vh]">
                  <div className="flex items-baseline gap-[1vw]">
                    <span className="font-display text-[1.7vw] font-light text-text tabular-nums leading-none">
                      {u.pct}%
                    </span>
                    <span className="font-display uppercase tracking-[0.18em] text-[0.78vw] text-text/70 font-medium">
                      {u.label}
                    </span>
                  </div>
                  <span className="font-display text-[1vw] text-text/55 font-light tabular-nums">
                    {u.amount}
                  </span>
                </div>
                <div className="h-[1.5vh] w-full rounded-full bg-text/10 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${u.bar}`}
                    style={{ width: `${u.pct}%`, transformOrigin: "left" }}
                    initial={reduce ? false : { scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={
                      reduce ? undefined : { duration: 0.7, ease: EASE, delay: 0.36 + i * 0.08 }
                    }
                  />
                </div>
                <div className="mt-[0.8vh] font-body text-[0.78vw] leading-[1.4] text-text/45">
                  {u.sub}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          className="mt-[2.4vh] text-center"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.6 }}
        >
          <div className="font-display text-[2vw] font-light tracking-[-0.02em] leading-[1.12] text-text">
            <span className="text-red">This raise funds the proof.</span>{" "}
            <span className="text-blue font-normal">The next round funds the scale.</span>
          </div>
        </motion.div>
      </div>
    </SlideFrame>
  );
}
