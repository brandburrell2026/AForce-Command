import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

const PROOFS = [
  "Day 30 retention holds above 50%.",
  "OS activation clears 50% of buyers.",
  "Members log three or more engagements every week.",
  "Ritual adoption compounds week over week.",
  "Weekly active users grow without paid lift.",
];

export default function WhatProofLooksLike() {
  const reduce = useReducedMotion();
  const base = import.meta.env.BASE_URL;
  const photo = `${base}images/bg/15-proof.png`;

  return (
    <SlideFrame slide={15}>
      {/* cinematic backdrop — a lone musician performer alone on a vast,
          light-filled stage at dawn: proof is earned, not bought. The figure
          sits behind the framing column on the left; the bright open haze backs
          the proof list on the right. A graduated paper veil keeps every line
          crisp. */}
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
        <div className="absolute inset-0 bg-[#e7e3db]/32" />
        {/* legibility scrim — lighter at top (lets the light burst breathe),
            denser through the central copy band */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(231,227,219,0.46) 0%, rgba(231,227,219,0.72) 32%, rgba(228,224,216,0.82) 60%, rgba(228,224,216,0.72) 82%, rgba(220,215,206,0.80) 100%)",
          }}
        />
      </div>

      {/* faint depth glow, lower-left — by the performer on the stage */}
      <div
        aria-hidden
        className="absolute left-[-8vw] bottom-[-10vh] h-[52vh] w-[52vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(228,30,43,0.09) 0%, rgba(228,30,43,0) 68%)",
          filter: "blur(8px)",
        }}
      />

      <div className="absolute inset-0 flex items-center gap-[4vw] px-[5vw] pt-[12vh] pb-[10vh]">
        {/* LEFT — the framing */}
        <div className="w-[36%] shrink-0">
          <motion.div
            className="mb-[3.5vh]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
          >
            <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
              The Proof
            </span>
          </motion.div>

          <motion.h1
            className="font-display font-light tracking-[-0.025em] text-[3.8vw] leading-[1.04] text-text"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
          >
            What proof
            <br />
            looks like.
          </motion.h1>

          <motion.p
            className="mt-[4vh] font-display font-light tracking-[-0.01em] text-[1.5vw] leading-[1.3] text-text/85"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.2 }}
          >
            By{" "}
            <span className="text-red font-normal">January 2027</span>, these are
            true. The model is proven.
          </motion.p>

          <motion.div
            className="mt-[5vh]"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.5 }}
          >
            <span className="block w-[2.4vw] h-[2px] bg-red mb-[2vh]" />
            <p className="font-display font-medium tracking-[-0.015em] text-[1.95vw] leading-[1.1] text-text">
              Binary. Measurable.
              <span className="block text-red font-semibold">
                Proven before we scale.
              </span>
            </p>
          </motion.div>
        </div>

        {/* divider */}
        <div aria-hidden className="self-stretch w-px bg-text/12 my-[4vh]" />

        {/* RIGHT — the binary proof points */}
        <div className="flex flex-1 flex-col justify-center gap-[2.2vh]">
          {PROOFS.map((p, i) => (
            <motion.div
              key={p}
              className="flex items-center gap-[1.6vw] border-b border-text/12 pb-[2.2vh]"
              initial={reduce ? false : { opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={
                reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.35 + i * 0.1 }
              }
            >
              <span className="w-[3vw] shrink-0 font-display font-light tabular-nums text-[2.4vw] leading-none text-text/25">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 font-body text-[1.25vw] leading-[1.3] text-text/85">
                {p}
              </span>
              <span
                aria-hidden
                className="flex shrink-0 items-center justify-center rounded-[3px] border border-red text-red"
                style={{ width: "1.7vw", height: "1.7vw" }}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-[0.95vw] w-[0.95vw]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
