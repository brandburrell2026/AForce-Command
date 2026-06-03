import type { ReactNode } from "react";

import { sectionFor, TOTAL_SLIDES } from "@/components/SlideChrome";
import Wordmark from "@/components/Wordmark";

interface SlideFrameProps {
  slide: number;
  /** Dark cinematic mode — black canvas, light chrome. */
  invert?: boolean;
  phaseLabel?: string;
  /** Hide the small header wordmark (e.g. when the slide shows its own large brand mark). */
  hideTopWordmark?: boolean;
  children: ReactNode;
}

/**
 * Atmospheric grey-toned "paper" — an overhead-lit warm-grey wall, lighter at
 * the top-center and settling into soft grey toward the lower corners. Mirrors
 * the lit concrete wall behind the figure on slide 7 so every light slide
 * shares the same mood.
 */
const PAPER_BG =
  "radial-gradient(125% 115% at 50% -5%, #efece6 0%, #e4e0d8 52%, #d6d1c8 100%)";

/**
 * Shared chrome for every slide: AForce wordmark + Patent-Protected pill on
 * top, and the confidential / section / page rule on the bottom. Content is
 * supplied as children and owns its own layout.
 */
export default function SlideFrame({
  slide,
  invert = false,
  phaseLabel = "Phase 1 — Proof of Concept",
  hideTopWordmark = false,
  children,
}: SlideFrameProps) {
  const { index, name } = sectionFor(slide);
  const topLabel = `Section ${index} — ${name}`;
  const pageLabel = `${String(slide).padStart(2, "0")} / ${String(TOTAL_SLIDES).padStart(2, "0")}`;

  const ink = invert ? "text-cream" : "text-text";
  const muted = invert ? "text-cream/55" : "text-text/55";
  const ruleColor = invert ? "border-cream/20" : "border-text/25";
  const pill = invert ? "text-cream border-cream/70" : "text-red border-red";

  return (
    <div
      className={`w-screen h-screen overflow-hidden relative ${ink} font-body ${invert ? "bg-black" : ""}`}
      style={invert ? undefined : { background: PAPER_BG }}
    >
      <div className="absolute inset-0 z-10">
        {children}
      </div>

      {/* TOP CHROME */}
      <div className="absolute top-[4.5vh] left-[5vw] right-[5vw] flex justify-between items-start z-20 pointer-events-none">
        {hideTopWordmark ? <span /> : <Wordmark className="h-[1.5vw]" />}
        <div
          className={`uppercase tracking-[0.22em] text-[0.62vw] font-semibold border px-[0.7vw] py-[0.35vh] rounded-full ${pill}`}
        >
          Patent-Protected
        </div>
      </div>

      {/* BOTTOM RULE */}
      <div
        className={`absolute bottom-[4vh] left-[5vw] right-[5vw] z-20 pointer-events-none flex justify-between items-end gap-[2vw] border-t ${ruleColor} pt-[1.6vh]`}
      >
        <div
          className={`font-body uppercase tracking-[0.28em] text-[0.6vw] ${muted} font-medium whitespace-nowrap`}
        >
          Confidential · For discussion purposes only
        </div>
        <div className="flex items-end gap-[2vw]">
          <div
            className={`font-body uppercase tracking-[0.28em] text-[0.6vw] ${ink} font-semibold whitespace-nowrap`}
          >
            {topLabel} · {phaseLabel}
          </div>
          <div
            className={`font-body uppercase tracking-[0.28em] text-[0.7vw] ${muted} font-medium tabular-nums`}
          >
            {pageLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
