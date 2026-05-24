import { motion } from "framer-motion";
import type { ReactNode } from "react";

export const TOTAL_SLIDES = 31;

const SECTIONS: Array<{ name: string; range: [number, number] }> = [
  { name: "Positioning", range: [1, 7] },
  { name: "Product & Ecosystem", range: [8, 13] },
  { name: "People", range: [14, 16] },
  { name: "Target Group & Market", range: [17, 20] },
  { name: "Go to Market", range: [21, 25] },
  { name: "Economics", range: [26, 28] },
  { name: "The Ask & Future", range: [29, 31] },
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
  const label = eyebrow ?? `Section ${index} · ${name}`;
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-bg text-text font-body">
      <motion.div
        className="absolute inset-0 pointer-events-none z-[5]"
        initial={{ opacity: 0.55 }}
        animate={{ opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 18, ease: "easeInOut", repeat: Infinity }}
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 50%, rgba(0,0,0,0.45) 100%)",
          mixBlendMode: "multiply",
        }}
      />

      <motion.div
        className="absolute inset-0 w-full h-full"
        initial={{ opacity: 0, scale: 0.985, filter: "blur(6px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.95, ease: [0.22, 0.61, 0.36, 1], delay: 0.05 }}
      >
        {children}
      </motion.div>

      {!hideChrome && (
        <motion.div
          className="absolute inset-0 pointer-events-none z-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          <div className="absolute top-[5vh] left-[6vw] right-[6vw] flex justify-between items-center">
            <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold">
              {label}
            </div>
            <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold tabular-nums">
              {String(slide).padStart(2, "0")} / {String(TOTAL_SLIDES).padStart(2, "0")}
            </div>
          </div>
          <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] flex justify-between items-center">
            <div className="font-body uppercase tracking-[0.4em] text-[0.7vw] text-text/30 font-semibold">
              AForce<span className="text-[0.55em] align-super tracking-normal ml-[0.15em]">™</span>
            </div>
            <div className="font-body uppercase tracking-[0.4em] text-[0.7vw] text-text/30 font-semibold">
              Phase 1 · Proof of Concept
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
