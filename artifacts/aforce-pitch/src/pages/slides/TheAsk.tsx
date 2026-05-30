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
    bar: "bg-text/55",
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
      <div className="absolute inset-0 flex flex-col justify-center px-[5vw] pt-[12vh] pb-[10vh]">
        <motion.div
          className="mb-[2.6vh]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
            The Ask
          </span>
        </motion.div>

        <div className="flex items-end gap-[2.5vw]">
          <motion.div
            className="font-display font-normal tracking-[0.01em] text-[8.5vw] leading-[0.82] text-text"
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.7, ease: EASE, delay: 0.08 }}
          >
            $4<span className="text-red">M</span>
          </motion.div>
          <motion.div
            className="mb-[1.8vh] font-body text-[1.1vw] leading-[1.5] text-text/70 max-w-[26vw]"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.28 }}
          >
            A proof-of-concept raise. This capital funds proof of habit. The next
            round funds scale.
          </motion.div>
        </div>

        {/* use of funds — four full-width allocation bars */}
        <div className="mt-[3.4vh] max-w-[78vw]">
          <div className="font-display uppercase tracking-[0.22em] text-[0.68vw] text-text/40 font-medium mb-[1.6vh]">
            Use of funds
          </div>

          <div className="flex flex-col gap-[1.7vh]">
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
          className="mt-[3.6vh] text-center"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.6 }}
        >
          <div className="font-display text-[2vw] font-light tracking-[-0.02em] leading-[1.15] text-text">
            This raise funds the proof.{" "}
            <span className="text-red font-normal">The next round funds the scale.</span>
          </div>
        </motion.div>
      </div>
    </SlideFrame>
  );
}
