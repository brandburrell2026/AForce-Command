import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";
import Wordmark from "@/components/Wordmark";

const EASE = [0.16, 1, 0.3, 1] as const;

type Tone = "ink" | "red" | "blue";

// The five compounding forces — each layer monetizes the one before it.
const FORCES: Array<{ subject: string; outcome: string; tone: Tone }> = [
  { subject: "product", outcome: "entry", tone: "red" },
  { subject: "ritual", outcome: "behavior", tone: "ink" },
  { subject: "OS", outcome: "retention", tone: "blue" },
  { subject: "membership", outcome: "recurring revenue", tone: "blue" },
  { subject: "ecosystem", outcome: "scale", tone: "red" },
];

// The full arc — identity in, scale out.
const ARC: Array<{ w: string; tone: Tone }> = [
  { w: "Product", tone: "red" },
  { w: "Ritual", tone: "ink" },
  { w: "Behavior", tone: "ink" },
  { w: "Retention", tone: "blue" },
  { w: "Membership", tone: "ink" },
  { w: "Scale", tone: "red" },
];

const toneText = (t: Tone) =>
  t === "red" ? "text-red" : t === "blue" ? "text-blue" : "text-text";

export default function TheCompounding() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={15} phaseLabel="The Compounding" hideTopWordmark>
      {/* faint depth glow, lower-right — the system warming as it compounds */}
      <div
        aria-hidden
        className="absolute right-[-6vw] bottom-[-8vh] h-[48vh] w-[48vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(228,30,43,0.10) 0%, rgba(228,30,43,0) 70%)",
        }}
      />

      {/* the brand, alone in the open right column — the last thing they see */}
      <div className="absolute right-[6vw] top-1/2 -translate-y-1/2 z-[5]">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.7, ease: EASE, delay: 1.1 }}
        >
          <Wordmark className="h-[6vw]" />
        </motion.div>
      </div>

      <div className="absolute inset-0 flex flex-col justify-center px-[5vw]">
        {/* eyebrow */}
        <motion.div
          className="mb-[3vh]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
            The Compounding System
          </span>
        </motion.div>

        {/* headline */}
        <motion.h1
          className="font-display font-light tracking-[-0.025em] text-[3.2vw] leading-[1.04] text-text mb-[5vh]"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
        >
          Every layer{" "}
          <span className="text-red font-normal">compounds the last.</span>
        </motion.h1>

        {/* the five compounding forces — a ladder */}
        <div className="flex flex-col gap-[2.4vh]">
          {FORCES.map((f, i) => (
            <motion.div
              key={f.subject}
              className="flex items-baseline gap-[1.6vw]"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.3 + i * 0.1 }
              }
            >
              <span className="font-display tabular-nums text-[0.72vw] tracking-[0.24em] text-red font-semibold w-[2vw] shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="font-display tracking-[-0.02em] leading-[1.1] text-[2.4vw]">
                <span className="text-text/40 font-light">The </span>
                <span className="text-text font-normal">{f.subject} </span>
                <span className="text-text/40 font-light italic">creates </span>
                <span className={`${toneText(f.tone)} font-semibold`}>
                  {f.outcome}
                </span>
                <span className="text-text/40 font-light">.</span>
              </p>
            </motion.div>
          ))}
        </div>

        {/* the full arc — identity in, scale out */}
        <motion.div
          className="mt-[6vh] flex items-center flex-wrap gap-x-[1.2vw] gap-y-[1.2vh]"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.9 }}
        >
          <span className="block w-[3.2vw] h-[3px] bg-red mr-[0.6vw]" />
          {ARC.map((node, i) => (
            <span key={node.w} className="flex items-center gap-x-[1.2vw]">
              <span
                className={`font-display uppercase tracking-[0.16em] text-[1.4vw] font-bold ${toneText(
                  node.tone,
                )}`}
              >
                {node.w}
              </span>
              {i < ARC.length - 1 && (
                <span className="font-display text-[1.4vw] text-text/30">→</span>
              )}
            </span>
          ))}
        </motion.div>
      </div>
    </SlideFrame>
  );
}
