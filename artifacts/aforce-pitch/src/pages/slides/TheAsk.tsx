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
    grad: "linear-gradient(90deg, #ff5a4f 0%, #ff8579 100%)",
    glow: "rgba(255,90,79,0.42)",
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
    <SlideFrame slide={21}>
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
              "radial-gradient(135% 96% at 50% 50%, rgba(236,234,228,0.96) 0%, rgba(236,234,228,0.93) 52%, rgba(236,234,228,0.82) 82%, rgba(236,234,228,0.55) 100%)",
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

      <div className="absolute inset-0 flex flex-col items-center justify-center px-[5vw] pt-[7vh] pb-[7vh] text-center">
        <motion.div
          className="mb-[1.4vh]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="font-display uppercase tracking-[0.34em] text-[0.82vw] text-red font-semibold">
            The Ask
          </span>
        </motion.div>

        {/* $4M — the single dominant element */}
        <motion.div
          className="font-display font-normal tracking-[0.005em] text-[8.6vw] leading-[0.82] text-text"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.7, ease: EASE, delay: 0.08 }}
        >
          $4<span className="text-red">M</span>
        </motion.div>
        <motion.p
          className="mt-[1.6vh] max-w-[42vw] font-body text-[1.15vw] leading-[1.5] text-text/65"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.28 }}
        >
          A proof-of-concept raise — capital to fund proof of habit before we scale.
        </motion.p>

        {/* use of funds — ONE stacked allocation bar + breakdown grid */}
        <div className="mt-[4.4vh] w-full max-w-[66vw]">
          <div className="mb-[1.8vh] flex items-end justify-between">
            <span className="font-display uppercase tracking-[0.24em] text-[0.74vw] text-text/55 font-semibold border-b-2 border-red pb-[0.6vh]">
              Use of funds
            </span>
            <span className="font-display uppercase tracking-[0.2em] text-[0.74vw] text-text/40 font-semibold">
              $4M total
            </span>
          </div>

          {/* single proportional stacked bar */}
          <motion.div
            className="flex w-full h-[3.8vh] gap-[3px] rounded-full overflow-hidden"
            style={{ transformOrigin: "left" }}
            initial={reduce ? false : { scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={reduce ? undefined : { duration: 0.85, ease: EASE, delay: 0.34 }}
          >
            {USE.map((u) => (
              <div
                key={u.label}
                className="h-full"
                style={{
                  flexBasis: `${u.pct}%`,
                  background: u.grad,
                  boxShadow: `0 0 18px -4px ${u.glow}`,
                }}
              />
            ))}
          </motion.div>

          {/* breakdown grid — one column per allocation */}
          <div className="mt-[3.4vh] grid grid-cols-4 gap-[1.8vw] text-left">
            {USE.map((u, i) => (
              <motion.div
                key={u.label}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.5 + i * 0.08 }
                }
              >
                <span
                  className="block h-[3px] w-full rounded-full mb-[1.4vh]"
                  style={{ background: u.grad }}
                />
                <div className="flex items-baseline gap-[0.6vw]">
                  <span className="font-display text-[2.9vw] font-normal text-text tabular-nums leading-none">
                    {u.pct}%
                  </span>
                  <span className="font-display text-[1vw] text-text/55 font-normal tabular-nums">
                    {u.amount}
                  </span>
                </div>
                <div className="mt-[1.2vh] font-display uppercase tracking-[0.14em] text-[0.92vw] text-text font-semibold leading-[1.2]">
                  {u.label}
                </div>
                <div className="mt-[0.7vh] font-body text-[0.78vw] leading-[1.4] text-text/50">
                  {u.sub}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* standout closing line */}
        <motion.div
          className="mt-[5vh]"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.85 }}
        >
          <div className="font-display text-[2.9vw] font-bold tracking-[-0.025em] leading-[1.05] text-text">
            The final goal{" "}
            <span className="text-red">before we scale.</span>
          </div>
        </motion.div>
      </div>
    </SlideFrame>
  );
}
