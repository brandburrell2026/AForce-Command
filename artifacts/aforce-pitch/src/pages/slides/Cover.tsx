import { motion } from "framer-motion";

export default function Cover() {
  const base = import.meta.env.BASE_URL;
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      {/* RIGHT — cinematic editorial hero */}
      <div className="absolute inset-y-0 right-0 w-[45%] overflow-hidden bg-bg">
        <img
          src={`${base}images/cover-hero.png`}
          alt="The quiet moment before a high performer begins their day"
          className="w-full h-full object-cover"
          style={{ objectPosition: "30% center" }}
        />
        {/* soft gradient bleed into cream on the left edge so the seam disappears */}
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 w-[6vw] pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, rgba(244,241,234,1) 0%, rgba(244,241,234,0) 100%)",
          }}
        />
      </div>

      {/* LEFT — cream wash holds the typography */}
      <motion.div
        className="absolute inset-y-0 left-0 w-[55%] flex flex-col px-[5vw] pt-[18vh] pb-[10vh] z-10"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1], delay: 0.1 }}
      >
        {/* eyebrow with underline */}
        <div className="mb-[5vh]">
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-blue font-semibold border-b-2 border-blue pb-[0.6vh]">
            Executive Summary
          </span>
        </div>

        {/* hero stack */}
        <h1 className="font-display font-light tracking-[-0.025em] text-[5.6vw] leading-[1.02] text-text">
          <div>A behavioral</div>
          <div className="text-red font-normal">performance</div>
          <div>ecosystem.</div>
        </h1>

        {/* ritual row */}
        <div className="mt-[5vh] font-display font-light text-[2.2vw] leading-none tracking-[-0.02em] flex flex-wrap gap-x-[1.4vw]">
          <span className="text-red font-normal">Pause.</span>
          <span className="text-text">Hydrate.</span>
          <span className="text-blue font-normal">Lock in.</span>
          <span className="text-text">Perform.</span>
        </div>

        {/* footer copy */}
        <div className="mt-[5vh] font-display text-[1vw] leading-[1.55] text-text/75 font-normal italic">
          <p>The product creates entry.</p>
          <p>The ritual creates behavior.</p>
          <p>The OS creates retention.</p>
        </div>

        {/* bottom rule */}
        <div className="mt-auto pt-[2.4vh] border-t border-text/25 flex items-center justify-between gap-[2vw]">
          <div className="font-display uppercase tracking-[0.28em] text-[0.6vw] text-text/55 font-medium whitespace-nowrap">
            Confidential · For discussion purposes only
          </div>
          <div className="font-display uppercase tracking-[0.28em] text-[0.6vw] text-text font-semibold whitespace-nowrap">
            Build proof before scale.
          </div>
        </div>
      </motion.div>

      {/* TOP CHROME — AForce wordmark left, investor briefing + patent badge right */}
      <motion.div
        className="absolute top-[4.5vh] left-[5vw] right-[5vw] flex justify-between items-start z-20 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.35 }}
      >
        <div className="font-display font-extrabold tracking-tight text-[1.4vw] text-red leading-none">
          AFORCE
          <span className="text-[0.55em] align-super tracking-normal ml-[0.1em] font-medium">
            ™
          </span>
        </div>
        <div className="flex items-center gap-[1.4vw]">
          <div className="font-display uppercase tracking-[0.28em] text-[0.7vw] text-text/55 font-medium">
            Investor Deck · Phase 1 · Proof of Concept · May 2026
          </div>
          <div
            className="uppercase tracking-[0.22em] text-[0.62vw] font-semibold text-red border border-red px-[0.7vw] py-[0.35vh] rounded-full"
            style={{ backgroundColor: "rgba(244,241,234,0.92)" }}
          >
            Patent-Protected
          </div>
          <div
            className="font-display uppercase tracking-[0.28em] text-[0.7vw] text-white font-medium whitespace-nowrap px-[0.6vw] py-[0.35vh] rounded-full"
            style={{ backgroundColor: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
          >
            U.S. Prov. 64/057,695
          </div>
        </div>
      </motion.div>
    </div>
  );
}
