import type { ReactNode } from "react";

import Wordmark from "@/components/Wordmark";

export const TOTAL_SLIDES = 25;

const BG_NAMES = [
  "final", "shift", "realdeal", "prize", "noise",
  "whitespace", "ritual", "system", "moat", "proof",
  "founders", "road", "proofpoints", "economics", "ask",
];

const SECTIONS: Array<{ name: string; range: [number, number] }> = [
  { name: "The Stakes", range: [1, 2] },
  { name: "The Team", range: [3, 5] },
  { name: "The Opportunity", range: [6, 8] },
  { name: "The System", range: [9, 13] },
  { name: "The Plan", range: [14, 22] },
  { name: "The Close", range: [23, 25] },
];

export function sectionFor(slide: number): { index: number; name: string } {
  const idx = SECTIONS.findIndex(
    (s) => slide >= s.range[0] && slide <= s.range[1],
  );
  const safe = idx === -1 ? 0 : idx;
  return { index: safe + 1, name: SECTIONS[safe].name };
}

export function isSectionFirstSlide(slide: number): boolean {
  return SECTIONS.some((s) => s.range[0] === slide);
}

interface ChromeProps {
  slide: number;
  eyebrow?: string;
  children: ReactNode;
  hideChrome?: boolean;
  invertChrome?: boolean;
}

export default function SlideChrome({
  slide,
  eyebrow,
  children,
  hideChrome = false,
  invertChrome = false,
}: ChromeProps) {
  const { index, name } = sectionFor(slide);
  const label = eyebrow ?? `${String(index).padStart(2, "0")} · ${name}`;
  const ink = invertChrome ? "text-bg" : "text-text";
  const muted = invertChrome ? "text-bg/55" : "text-text/55";
  const subtle = invertChrome ? "text-bg/35" : "text-text/40";
  const stroke = invertChrome ? "border-bg/35" : "border-text/40";

  const base = import.meta.env.BASE_URL;
  const bgSlug = String(slide).padStart(2, "0");
  const bgUrl = `${base}images/bg/${bgSlug}-${BG_NAMES[slide - 1]}.png`;

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      {/* themed background plate — very faded so it reads as paper texture */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${bgUrl})`,
          opacity: 0.45,
        }}
      />
      {/* cream wash to keep type crisp */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 bg-bg/70 pointer-events-none"
      />

      <div className="absolute inset-0 w-full h-full z-10">
        {children}
      </div>

      {!hideChrome && (
        <div className="absolute inset-0 pointer-events-none z-20">
          {/* TOP CHROME — AForce wordmark left, investor briefing line + patent badge right */}
          <div className="absolute top-[4.5vh] left-[5vw] right-[5vw] flex justify-between items-start">
            <Wordmark className="h-[1.5vw]" />
            <div className="flex items-center gap-[1.4vw]">
              <div className={`font-body uppercase tracking-[0.28em] text-[0.7vw] ${muted} font-medium`}>
                Investor Deck · Phase 1 · Proof of Concept
              </div>
              <div className={`uppercase tracking-[0.22em] text-[0.62vw] font-semibold text-red border border-red px-[0.7vw] py-[0.35vh] rounded-full whitespace-nowrap`}>
                Proprietary IP &amp; Patent Applications Filed
              </div>
            </div>
          </div>

          {/* SECTION + PAGE COUNT — second row, subtle */}
          <div className="absolute top-[10vh] left-[5vw] right-[5vw] flex justify-between items-center">
            <div className={`font-body uppercase tracking-[0.32em] text-[0.62vw] ${subtle} font-medium`}>
              {label}
            </div>
            <div className={`font-body uppercase tracking-[0.32em] text-[0.62vw] ${subtle} font-medium tabular-nums`}>
              {String(slide).padStart(2, "0")} / {String(TOTAL_SLIDES).padStart(2, "0")}
            </div>
          </div>

          {/* BOTTOM CHROME — confidential line + bold statement */}
          <div className="absolute bottom-[3.6vh] left-[5vw] right-[8vw]">
            <div className={`flex items-center justify-between gap-[3vw] border-t ${stroke}/30 pt-[1.4vh]`}>
              <div className={`font-body uppercase tracking-[0.28em] text-[0.6vw] ${subtle} font-medium whitespace-nowrap`}>
                Confidential · For discussion purposes only
              </div>
              <div className={`font-body uppercase tracking-[0.28em] text-[0.62vw] ${ink} font-semibold whitespace-nowrap`}>
                Build proof before scale.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
