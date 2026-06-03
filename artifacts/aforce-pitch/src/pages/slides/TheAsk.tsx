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
  },
  {
    pct: 25,
    label: "Marketing & Activation",
    sub: "Brickell + NYC density, event, paid acquisition",
    amount: "$1,000,000",
  },
  {
    pct: 25,
    label: "Tech & OS Development",
    sub: "AForce OS build, app, retention infrastructure",
    amount: "$1,000,000",
  },
  {
    pct: 15,
    label: "Team & Operations",
    sub: "Salaries, legal, insurance, overhead · ~$50K/mo",
    amount: "$600,000",
  },
];

export default function TheAsk() {
  const reduce = useReducedMotion();
  const base = import.meta.env.BASE_URL;
  const photo = `${base}images/bg/17-ask.png`;

  return (
    <SlideFrame slide={17}>
      {/* closing backdrop — a lone figure facing a vast dawn horizon: the
          forward look, the scale ahead. Held far behind the numbers by a
          center-dense veil so the $4M and the use-of-funds bars stay crisp;
          the image breathes only at the top and bottom edges. */}
      <div aria-hidden className="absolute inset-0 overflow-hidden">
        <motion.img
          src={photo}
          alt=""
          className="absolute inset-0 h-full w-full origin-center scale-[1.04] object-cover object-center"
          initial={reduce ? false : { opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1.04 }}
          transition={reduce ? undefined : { duration: 1.4, ease: EASE }}
        />
        {/* warm temperature veil so the cool image harmonizes with the paper */}
        <div className="absolute inset-0 bg-[#e7e3db]/30" />
        {/* radial legibility scrim — denser through the central content band,
            opening up at the top and bottom edges where the horizon can breathe */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 50% 48%, rgba(228,224,216,0.86) 0%, rgba(228,224,216,0.80) 44%, rgba(231,227,219,0.56) 76%, rgba(231,227,219,0.30) 100%)",
          }}
        />
      </div>

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

        {/* use of funds — one $4M, split to scale */}
        <div className="mt-[2.8vh] w-full max-w-[64vw] text-left">
          <div className="flex items-baseline justify-between mb-[1.4vh]">
            <span className="inline-block font-display uppercase tracking-[0.22em] text-[0.68vw] text-text/45 font-semibold border-b-2 border-red pb-[0.6vh]">
              Use of funds
            </span>
            <span className="font-display uppercase tracking-[0.2em] text-[0.66vw] text-text/35 tabular-nums">
              $4,000,000 total
            </span>
          </div>

          {/* single allocation bar — the whole raise at once, split to scale */}
          <motion.div
            className="flex h-[2.1vh] w-full gap-[4px]"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.3 }}
          >
            {USE.map((u, i) => (
              <motion.div
                key={u.label}
                className="h-full bg-red first:rounded-l-full last:rounded-r-full"
                style={{ width: `${u.pct}%`, transformOrigin: "left" }}
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={
                  reduce ? undefined : { duration: 0.7, ease: EASE, delay: 0.36 + i * 0.07 }
                }
              />
            ))}
          </motion.div>

          {/* breakdown — one column per allocation, tied to the bar above */}
          <div className="mt-[2.2vh] grid grid-cols-4 gap-[1.8vw]">
            {USE.map((u, i) => (
              <motion.div
                key={u.label}
                className="border-t-2 border-red/80 pt-[1.1vh]"
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.46 + i * 0.07 }
                }
              >
                <div className="font-display font-light text-text tabular-nums leading-none">
                  <span className="text-[2.2vw]">{u.pct}</span>
                  <span className="text-[1vw] text-text/50">%</span>
                </div>
                <div className="mt-[1vh] font-display uppercase tracking-[0.16em] text-[0.72vw] text-text font-semibold leading-[1.3]">
                  {u.label}
                </div>
                <div className="mt-[0.6vh] font-display text-[0.84vw] text-red font-medium tabular-nums">
                  {u.amount}
                </div>
                <div className="mt-[0.8vh] font-body text-[0.72vw] leading-[1.45] text-text/45">
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
