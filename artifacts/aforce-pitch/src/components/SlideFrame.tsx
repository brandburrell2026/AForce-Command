import type { ReactNode } from "react";

import { sectionFor, TOTAL_SLIDES } from "@/components/SlideChrome";

interface SlideFrameProps {
  slide: number;
  /** Dark cinematic mode — black canvas, light chrome. */
  invert?: boolean;
  phaseLabel?: string;
  children: ReactNode;
}

/**
 * Shared chrome for every slide: AForce wordmark + Patent-Protected pill on
 * top, and the confidential / section / page rule on the bottom. Content is
 * supplied as children and owns its own layout.
 */
export default function SlideFrame({
  slide,
  invert = false,
  phaseLabel = "Phase 1 — Proof of Concept",
  children,
}: SlideFrameProps) {
  const { index, name } = sectionFor(slide);
  const topLabel = `Section ${index} — ${name}`;
  const pageLabel = `${String(slide).padStart(2, "0")} / ${String(TOTAL_SLIDES).padStart(2, "0")}`;

  const bg = invert ? "bg-[#0B0D12]" : "bg-bg";
  const ink = invert ? "text-[#F5F4F1]" : "text-text";
  const muted = invert ? "text-[#F5F4F1]/55" : "text-text/55";
  const ruleColor = invert ? "border-[#F5F4F1]/20" : "border-text/25";
  const pill = invert ? "text-[#F5F4F1] border-[#F5F4F1]/70" : "text-red border-red";

  return (
    <div className={`w-screen h-screen overflow-hidden relative ${bg} ${ink} font-body`}>
      <div className="absolute inset-0 z-10">
        {children}
      </div>

      {/* TOP CHROME */}
      <div className="absolute top-[4.5vh] left-[5vw] right-[5vw] flex justify-between items-start z-20 pointer-events-none">
        <div className="font-display font-extrabold tracking-tight text-[1.4vw] text-red leading-none">
          AForce
        </div>
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
          className={`font-display uppercase tracking-[0.28em] text-[0.6vw] ${muted} font-medium whitespace-nowrap`}
        >
          Confidential · For discussion purposes only
        </div>
        <div className="flex items-end gap-[2vw]">
          <div
            className={`font-display uppercase tracking-[0.28em] text-[0.6vw] ${ink} font-semibold whitespace-nowrap`}
          >
            {topLabel} · {phaseLabel}
          </div>
          <div
            className={`font-display uppercase tracking-[0.28em] text-[0.7vw] ${muted} font-medium tabular-nums`}
          >
            {pageLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
