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
    grad: "linear-gradient(90deg, #e41e2b 0%, #ff5246 100%)",
    glow: "rgba(228,30,43,0.45)",
  },
  {
    pct: 25,
    label: "Marketing & Activation",
    sub: "Brickell + NYC density, event, paid acquisition",
    amount: "$1,000,000",
    grad: "linear-gradient(90deg, #e41e2b 0%, #ff5246 100%)",
    glow: "rgba(228,30,43,0.45)",
  },
  {
    pct: 25,
    label: "Tech & OS Development",
    sub: "AForce OS build, app, retention infrastructure",
    amount: "$1,000,000",
    grad: "linear-gradient(90deg, #2f5bff 0%, #6b8bff 100%)",
    glow: "rgba(47,91,255,0.45)",
  },
  {
    pct: 15,
    label: "Team & Operations",
    sub: "Salaries, legal, insurance, overhead · ~$50K/mo",
    amount: "$600,000",
    grad: "linear-gradient(90deg, #3a352f 0%, #6b645c 100%)",
    glow: "rgba(26,24,19,0.32)",
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
        <div className="absolute inset-0 bg-[#eceae4]/42" />
        {/* radial legibility scrim — eased back so the dawn horizon breathes
            more, while the central content band stays crisp behind the numbers */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(130% 88% at 50% 46%, rgba(236,234,228,0.9) 0%, rgba(236,234,228,0.84) 48%, rgba(236,234,228,0.58) 78%, rgba(236,234,228,0.3) 100%)",
          }}
        />
      </div>

      {/* hero glow behind the $4M — red energy */}
      <motion.div
        aria-hidden
        className="absolute left-1/2 top-[20vh] h-[40vh] w-[40vh] -translate-x-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(228,30,43,0.16) 0%, rgba(228,30,43,0) 68%)",
          filter: "blur(8px)",
        }}
        initial={reduce ? false : { opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduce ? undefined : { duration: 1.4, ease: EASE }}
      />
      {/* cool OS-blue accent halo, lower-right */}
      <div
        aria-hidden
        className="absolute right-[-6vw] bottom-[2vh] h-[40vh] w-[40vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(47,91,255,0.10) 0%, rgba(47,91,255,0) 70%)",
          filter: "blur(8px)",
        }}
      />

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
                    <span className="font-display text-[1.95vw] font-normal text-text tabular-nums leading-none">
                      {u.pct}%
                    </span>
                    <span className="font-display uppercase tracking-[0.18em] text-[0.82vw] text-text/75 font-semibold">
                      {u.label}
                    </span>
                  </div>
                  <span className="font-display text-[1.1vw] text-text/75 font-normal tabular-nums">
                    {u.amount}
                  </span>
                </div>
                <div className="h-[1.9vh] w-full rounded-full bg-text/[0.07] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      width: `${u.pct}%`,
                      transformOrigin: "left",
                      background: u.grad,
                      boxShadow: `0 0 16px -2px ${u.glow}`,
                    }}
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
          <div className="font-display text-[2vw] font-bold tracking-[-0.02em] leading-[1.12] text-text">
            <span className="text-red">This raise funds the proof.</span>{" "}
            <span className="text-text/70 font-bold">The next round funds the scale.</span>
          </div>
        </motion.div>
      </div>
    </SlideFrame>
  );
}
