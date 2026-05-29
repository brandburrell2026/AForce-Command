import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { sectionFor, TOTAL_SLIDES } from "@/components/SlideChrome";

interface EditorialSlideProps {
  slide: number;
  eyebrow: string;
  headline: ReactNode;
  /** One supporting sentence. Per the deck rules: one message, one thought. */
  support: ReactNode;
  heroSrc: string;
  heroObjectPosition?: string;
  phaseLabel?: string;
}

/**
 * Split editorial slide: typography on a cream left column, a full-bleed
 * photograph on the right. Chrome stays on the cream so it is legible over
 * any image.
 */
export default function EditorialSlide({
  slide,
  eyebrow,
  headline,
  support,
  heroSrc,
  heroObjectPosition = "center",
  phaseLabel = "Phase 1 — Proof of Concept",
}: EditorialSlideProps) {
  const { index, name } = sectionFor(slide);
  const topLabel = `Section ${index} — ${name}`;
  const pageLabel = `${String(slide).padStart(2, "0")} / ${String(TOTAL_SLIDES).padStart(2, "0")}`;

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      {/* RIGHT — full-bleed hero photograph */}
      <div className="absolute inset-y-0 right-0 w-[55%]">
        <img
          src={heroSrc}
          alt=""
          className="w-full h-full object-cover"
          style={{ objectPosition: heroObjectPosition }}
        />
        {/* soft gradient bleed into cream so the seam disappears */}
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
        className="absolute inset-y-0 left-0 w-[55%] flex flex-col px-[5vw] pt-[12vh] pb-[5vh] z-10"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1], delay: 0.1 }}
      >
        <div className="mb-[5vh]">
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-blue font-semibold border-b-2 border-blue pb-[0.6vh]">
            {eyebrow}
          </span>
        </div>

        <h1 className="font-display font-light tracking-[-0.025em] text-[5.6vw] leading-[1.02] text-text">
          {headline}
        </h1>

        <div className="mt-[4vh] max-w-[34vw] font-display text-[1.15vw] leading-[1.5] text-text/70 font-normal">
          {support}
        </div>

        <div className="mt-auto pt-[2.4vh] border-t border-text/25 flex justify-between items-end gap-[2vw]">
          <div className="flex flex-col gap-[1vh] min-w-0">
            <div className="font-display uppercase tracking-[0.28em] text-[0.6vw] text-text/55 font-medium whitespace-nowrap">
              Confidential · For discussion purposes only
            </div>
            <div className="font-display uppercase tracking-[0.28em] text-[0.6vw] text-text font-semibold whitespace-nowrap">
              {topLabel} · {phaseLabel}
            </div>
          </div>
          <div className="font-display uppercase tracking-[0.28em] text-[0.7vw] text-text/60 font-medium tabular-nums shrink-0">
            {pageLabel}
          </div>
        </div>
      </motion.div>

      {/* TOP CHROME — wordmark + patent badge on the cream side */}
      <motion.div
        className="absolute top-[4.5vh] left-[5vw] z-20 flex flex-col items-start gap-[1.4vh] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.35 }}
      >
        <div className="font-display font-extrabold tracking-tight text-[1.4vw] text-red leading-none">
          AForce
        </div>
        <div className="uppercase tracking-[0.22em] text-[0.62vw] font-semibold text-red border border-red px-[0.7vw] py-[0.35vh] rounded-full">
          Patent-Protected
        </div>
      </motion.div>
    </div>
  );
}
