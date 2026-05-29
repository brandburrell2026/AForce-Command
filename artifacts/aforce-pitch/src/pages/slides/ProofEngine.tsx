import { motion, useReducedMotion } from "framer-motion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

export default function ProofEngine() {
  const base = import.meta.env.BASE_URL;
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={10} invert>
      {/* full-bleed cinematic figure */}
      <motion.img
        src={`${base}images/bg/16-silence-hooded3.png`}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: "center 18%" }}
        initial={reduce ? false : { scale: 1.06, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reduce ? undefined : { duration: 1.4, ease: EASE }}
      />

      {/* legibility wash — dark bottom-left, fading to clear top-right */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(8,9,12,0.94) 0%, rgba(8,9,12,0.55) 32%, rgba(8,9,12,0) 62%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to right, rgba(8,9,12,0.8) 0%, rgba(8,9,12,0.25) 34%, rgba(8,9,12,0) 60%)",
        }}
      />

      {/* content — anchored lower-left */}
      <div className="absolute inset-0 flex flex-col justify-end px-[5vw] pb-[13vh]">
        <motion.div
          className="mb-[3.5vh]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.25 }}
        >
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-blue font-semibold border-b-2 border-blue pb-[0.6vh]">
            The Proof Engine
          </span>
        </motion.div>

        <motion.h1
          className="font-display font-light tracking-[-0.025em] text-[5vw] leading-[0.98] text-white"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.7, ease: EASE, delay: 0.35 }}
        >
          <div>A concentrated</div>
          <div className="text-blue font-normal">proving ground.</div>
        </motion.h1>

        <motion.p
          className="mt-[3.5vh] max-w-[40vw] font-body text-[1.15vw] leading-[1.55] text-white/80"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.7, ease: EASE, delay: 0.5 }}
        >
          Miami and Brickell hold a dense population of high-performance
          consumers — the fastest place to prove habit before we scale.
        </motion.p>
      </div>
    </SlideFrame>
  );
}
