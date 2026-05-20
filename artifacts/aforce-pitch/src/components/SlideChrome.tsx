import type { ReactNode } from "react";

export const TOTAL_SLIDES = 26;

const SECTIONS: Array<{ name: string; range: [number, number] }> = [
  { name: "Opening", range: [1, 5] },
  { name: "Ritual & Loop", range: [6, 8] },
  { name: "Product & OS", range: [9, 13] },
  { name: "The Platform", range: [14, 17] },
  { name: "Market & GTM", range: [18, 20] },
  { name: "Economics", range: [21, 23] },
  { name: "Team & Ask", range: [24, 26] },
];

export function sectionFor(slide: number): { index: number; name: string } {
  const idx = SECTIONS.findIndex(
    (s) => slide >= s.range[0] && slide <= s.range[1],
  );
  const safe = idx === -1 ? 0 : idx;
  return { index: safe + 1, name: SECTIONS[safe].name };
}

interface ChromeProps {
  slide: number;
  eyebrow?: string;
  children: ReactNode;
  hideChrome?: boolean;
}

export default function SlideChrome({
  slide,
  eyebrow,
  children,
  hideChrome = false,
}: ChromeProps) {
  const { index, name } = sectionFor(slide);
  const label = eyebrow ?? `Section ${index} · ${name}`;
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      {children}
      {!hideChrome && (
        <>
          <div className="absolute top-[5vh] left-[6vw] right-[6vw] flex justify-between items-center z-20 pointer-events-none">
            <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold">
              {label}
            </div>
            <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold tabular-nums">
              {String(slide).padStart(2, "0")} / {String(TOTAL_SLIDES).padStart(2, "0")}
            </div>
          </div>
          <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] flex justify-between items-center z-20 pointer-events-none">
            <div className="font-body uppercase tracking-[0.4em] text-[0.7vw] text-text/30 font-semibold">
              AForce
            </div>
            <div className="font-body uppercase tracking-[0.4em] text-[0.7vw] text-text/30 font-semibold">
              Phase 1 · Proof of Concept
            </div>
          </div>
        </>
      )}
    </div>
  );
}
