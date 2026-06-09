import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";
import Wordmark from "@/components/Wordmark";

const EASE = [0.16, 1, 0.3, 1] as const;

type Tone = "ink" | "red" | "blue";

// The full arc — identity in, scale out.
const ARC: Array<{ w: string; tone: Tone }> = [
  { w: "Identity", tone: "red" },
  { w: "Ritual", tone: "ink" },
  { w: "Behavior", tone: "ink" },
  { w: "OS", tone: "blue" },
  { w: "Retention", tone: "blue" },
  { w: "Membership", tone: "ink" },
  { w: "Scale", tone: "red" },
];

// The three truths the laboratory proves.
const PROOFS: Array<{ lead: string; key: string; tone: Tone }> = [
  { lead: "Brickell is the", key: "laboratory", tone: "ink" },
  { lead: "The GTM is the", key: "proof sequence", tone: "red" },
  { lead: "The OS is the", key: "valuation multiplier", tone: "blue" },
];

const toneText = (t: Tone) =>
  t === "red" ? "text-red" : t === "blue" ? "text-blue" : "text-text";

export default function TheClose() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={22} phaseLabel="The Thesis" hideTopWordmark>
      {/* faint depth glow, lower-right — the system warming as it compounds */}
      <div
        aria-hidden
        className="absolute right-[-6vw] bottom-[-8vh] h-[48vh] w-[48vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(228,30,43,0.10) 0%, rgba(228,30,43,0) 70%)",
        }}
      />

      {/* brand mark, top-right */}
      <div className="absolute right-[6vw] top-[12vh] z-[5]">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.7, ease: EASE, delay: 1.2 }}
        >
          <Wordmark className="h-[3.2vw]" />
        </motion.div>
      </div>

      <div className="absolute inset-0 flex flex-col justify-center px-[5vw]">
        {/* eyebrow */}
        <motion.div
          className="mb-[2.6vh]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
            The Close
          </span>
        </motion.div>

        {/* headline */}
        <motion.h1
          className="font-display font-light tracking-[-0.025em] text-[2.6vw] leading-[1.12] text-text max-w-[66vw]"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
        >
          We are not proving that people like a{" "}
          <span className="text-text/40">hydration product.</span>
          <br />
          We are proving <span className="text-red font-normal">that:</span>
        </motion.h1>

        {/* the full arc — identity in, scale out */}
        <motion.div
          className="mt-[3.6vh] flex items-center flex-wrap gap-x-[1.1vw] gap-y-[1.2vh]"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.4 }}
        >
          <span className="block w-[3vw] h-[3px] bg-red mr-[0.4vw]" />
          {ARC.map((node, i) => (
            <span key={node.w} className="flex items-center gap-x-[1.1vw]">
              <span
                className={`font-display uppercase tracking-[0.14em] text-[1.3vw] font-bold ${toneText(
                  node.tone,
                )}`}
              >
                {node.w}
              </span>
              {i < ARC.length - 1 && (
                <span className="font-display text-[1.3vw] text-text/30">→</span>
              )}
            </span>
          ))}
        </motion.div>

        {/* three proof lines */}
        <div className="mt-[4.5vh] flex flex-col gap-[1.6vh]">
          {PROOFS.map((p, i) => (
            <motion.p
              key={p.key}
              className="font-display tracking-[-0.015em] text-[1.85vw] leading-[1.1]"
              initial={reduce ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={
                reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.7 + i * 0.12 }
              }
            >
              <span className="text-text/40 font-light">{p.lead} </span>
              <span className={`${toneText(p.tone)} font-semibold`}>{p.key}</span>
              <span className="text-text/40 font-light">.</span>
            </motion.p>
          ))}
        </div>

        {/* final line */}
        <motion.div
          className="mt-[4.5vh]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 1.15 }}
        >
          <span className="block w-[2.4vw] h-[2px] bg-red mb-[1.6vh]" />
          <p className="font-display font-medium tracking-[-0.02em] text-[2.1vw] leading-[1.08] text-text">
            Do not skip the proof sequence.{" "}
            <span className="block text-red font-semibold">
              The proof sequence is the business.
            </span>
          </p>
        </motion.div>
      </div>
    </SlideFrame>
  );
}
