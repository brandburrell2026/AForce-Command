import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { sectionFor, TOTAL_SLIDES } from "@/components/SlideChrome";

interface EditorialSlideProps {
  slide: number;
  eyebrow: string;
  headline: ReactNode;
  footer: ReactNode;
  heroSrc: string;
  heroObjectPosition?: string;
  sectionLabel?: string;
  phaseLabel?: string;
  /**
   * Opt-in (slide-specific): dissolve the photo's left edge into the
   * cream page instead of washing cream *over* the photo. Avoids the
   * muddy grey seam that the default bleed produces on dark images.
   */
  heroMaskFade?: boolean;
  /** Opt-in: extra cinematic grade rendered over the hero (vignette etc.). */
  heroOverlay?: ReactNode;
  /** Opt-in: editorial accent rule + roomier footer for a premium feel. */
  accent?: boolean;
}

export default function EditorialSlide({
  slide,
  eyebrow,
  headline,
  footer,
  heroSrc,
  heroObjectPosition = "center",
  sectionLabel,
  phaseLabel = "Phase 1 — Proof of Concept",
  heroMaskFade = false,
  heroOverlay,
  accent = false,
}: EditorialSlideProps) {
  const { index, name } = sectionFor(slide);
  const topLabel = sectionLabel ?? `Section ${index} — ${name}`;
  const pageLabel = `${String(slide).padStart(2, "0")} / ${String(TOTAL_SLIDES).padStart(2, "0")}`;

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      {/* RIGHT — full-bleed hero photograph */}
      <div className="absolute inset-y-0 right-0 w-[55%]">
        <img
          src={heroSrc}
          alt=""
          className="w-full h-full object-cover"
          style={{
            objectPosition: heroObjectPosition,
            ...(heroMaskFade
              ? {
                  WebkitMaskImage:
                    "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 9%, #000 18%)",
                  maskImage:
                    "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 9%, #000 18%)",
                }
              : {}),
          }}
        />
        {heroMaskFade ? (
          /* cinematic grade — handled by heroOverlay; no cream wash needed */
          heroOverlay
        ) : (
          <>
            {/* soft gradient bleed into cream on the left edge so the seam disappears */}
            <div
              aria-hidden
              className="absolute inset-y-0 left-0 w-[14vw] pointer-events-none"
              style={{
                background:
                  "linear-gradient(to right, rgba(244,241,234,1) 0%, rgba(244,241,234,0) 100%)",
              }}
            />
            {heroOverlay}
          </>
        )}
      </div>

      {/* LEFT — cream wash holds the typography */}
      <motion.div
        className="absolute inset-y-0 left-0 w-[55%] flex flex-col px-[5vw] pt-[10vh] pb-[8vh] z-10"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1], delay: 0.1 }}
      >
        {/* eyebrow */}
        <div className={`font-display uppercase tracking-[0.32em] text-[0.78vw] text-blue font-semibold ${accent ? "mb-[2.4vh]" : "mb-[6vh]"}`}>
          {eyebrow}
        </div>

        {/* editorial accent rule */}
        {accent ? (
          <motion.div
            aria-hidden
            className="h-px bg-blue/50 mb-[3vh] origin-left"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 0.61, 0.36, 1], delay: 0.4 }}
            style={{ width: "4.5vw" }}
          />
        ) : null}

        {/* hero stack */}
        <h1 className="font-display font-light tracking-[-0.02em] text-[6.6vw] leading-[1.02] text-text">
          {headline}
        </h1>

        {/* footer copy */}
        <div className="mt-auto pt-[4vh] font-display text-[1vw] leading-[1.6] text-text/70 font-normal italic">
          {footer}
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
          {topLabel}
        </div>
        <div className="font-display uppercase tracking-[0.32em] text-[0.72vw] text-text/60 font-medium tabular-nums">
          {pageLabel}
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
        </div>
        <div className="font-display uppercase tracking-[0.32em] text-[0.72vw] text-text/60 font-medium">
          {phaseLabel}
        </div>
      </motion.div>
    </div>
  );
}
