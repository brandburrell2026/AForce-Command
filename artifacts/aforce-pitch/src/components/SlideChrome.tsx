import { motion } from "framer-motion";
import type { ReactNode } from "react";

export const TOTAL_SLIDES = 15;

const SECTIONS: Array<{ name: string; range: [number, number] }> = [
  { name: "Tension", range: [1, 3] },
  { name: "The Shift", range: [4, 5] },
  { name: "The Product", range: [6, 7] },
  { name: "The System", range: [8, 9] },
  { name: "The People", range: [10, 11] },
  { name: "The Proof", range: [12, 13] },
  { name: "The Close", range: [14, 15] },
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
}

export default function SlideChrome({
  slide,
  eyebrow,
  children,
  hideChrome = false,
}: ChromeProps) {
  const { index, name } = sectionFor(slide);
  const label = eyebrow ?? `${String(index).padStart(2, "0")} · ${name}`;
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <motion.div
        className="absolute inset-0 w-full h-full"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 0.61, 0.36, 1], delay: 0.05 }}
      >
        {children}
      </motion.div>

      {!hideChrome && (
        <motion.div
          className="absolute inset-0 pointer-events-none z-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <div className="absolute top-[4.5vh] left-[5vw] right-[5vw] flex justify-between items-center">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/45 font-medium">
              {label}
            </div>
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/45 font-medium tabular-nums">
              {String(slide).padStart(2, "0")} / {String(TOTAL_SLIDES).padStart(2, "0")}
            </div>
          </div>
          <div className="absolute bottom-[4.5vh] left-[5vw] right-[5vw] flex justify-between items-center">
            <div className="font-body uppercase tracking-[0.32em] text-[0.65vw] text-text/35 font-medium">
              AForce<span className="text-[0.6em] align-super tracking-normal ml-[0.15em]">™</span>
            </div>
            <div className="font-body uppercase tracking-[0.32em] text-[0.65vw] text-text/35 font-medium">
              Investor Briefing · 2026
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
