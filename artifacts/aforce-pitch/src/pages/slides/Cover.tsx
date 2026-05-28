import { motion } from "framer-motion";

export default function Cover() {
  const base = import.meta.env.BASE_URL;
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      {/* RIGHT — full-bleed hero photograph */}
      <div className="absolute inset-y-0 right-0 w-[55%]">
        <img
          src={`${base}images/hero-figure.png`}
          alt=""
          className="w-full h-full object-cover"
          style={{ objectPosition: "82% center" }}
        />
        {/* soft gradient bleed into cream on the left edge so the seam disappears */}
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 w-[14vw] pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, rgba(244,241,234,1) 0%, rgba(244,241,234,0) 100%)",
          }}
        />
      </div>

      {/* LEFT — cream wash holds the typography */}
      <motion.div
        className="absolute inset-y-0 left-0 w-[55%] flex flex-col px-[5vw] pt-[10vh] pb-[8vh] z-10"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1], delay: 0.1 }}
      >
        {/* eyebrow */}
        <div className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-blue font-semibold mb-[6vh]">
          The Ritual
        </div>

        {/* hero stack */}
        <h1 className="font-display font-light tracking-[-0.02em] text-[6.6vw] leading-[1.02] text-text">
          <div>Pause.</div>
          <div>Hydrate.</div>
          <div className="text-blue font-normal">Lock in.</div>
          <div>Perform.</div>
        </h1>

        {/* footer copy */}
        <div className="mt-auto pt-[4vh] font-display text-[1vw] leading-[1.55] text-text/70 font-normal italic">
          <p>This is not a tagline.</p>
          <p>It is the behavioral operating system.</p>
          <p>The ritual creates accountability.</p>
          <p>Accountability creates retention.</p>
        </div>
      </motion.div>

      {/* TOP CHROME */}
      <motion.div
        className="absolute top-[4.5vh] left-[5vw] right-[5vw] flex justify-between items-start z-20 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.35 }}
      >
        <div className="font-display uppercase tracking-[0.32em] text-[0.72vw] text-text/60 font-medium">
          Section 1 — Positioning
        </div>
        <div className="font-display uppercase tracking-[0.32em] text-[0.72vw] text-text/60 font-medium tabular-nums">
          01 / 15
        </div>
      </motion.div>

      {/* BOTTOM CHROME */}
      <motion.div
        className="absolute bottom-[4.5vh] left-[5vw] right-[5vw] flex justify-between items-end z-20 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.45 }}
      >
        <div className="font-display font-extrabold tracking-tight text-[1.4vw] text-red leading-none">
          AForce
          <span className="text-[0.55em] align-super tracking-normal ml-[0.1em] font-medium">
            ™
          </span>
        </div>
        <div className="font-display uppercase tracking-[0.32em] text-[0.72vw] text-text/60 font-medium">
          Phase 1 — Proof of Concept
        </div>
      </motion.div>
    </div>
  );
}
