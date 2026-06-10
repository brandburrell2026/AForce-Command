import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

type Tone = "ink" | "red" | "blue";

const SIGNALS: Array<{
  frame: string;
  metric: string;
  label: string;
  tag: string;
  tone: Tone;
}> = [
  {
    frame: "Proof of Belief",
    metric: "60+",
    label: "NPS",
    tag: "People believe.",
    tone: "red",
  },
  {
    frame: "Proof of Utility",
    metric: "60%+",
    label: "60-Day Retention",
    tag: "People stay.",
    tone: "blue",
  },
  {
    frame: "Proof of Commitment",
    metric: "20%+",
    label: "Membership Conversion",
    tag: "People commit.",
    tone: "ink",
  },
];

const toneText = (t: Tone) =>
  t === "red" ? "text-red" : t === "blue" ? "text-blue" : "text-text";
const toneBg = (t: Tone) =>
  t === "red" ? "bg-red" : t === "blue" ? "bg-blue" : "bg-text";

export default function ThreeSignals() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={10}>
      {/* cool accent halo, upper-right — ties to the OS blue */}
      <div
        aria-hidden
        className="absolute right-[-6vw] top-[6vh] h-[46vh] w-[46vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(47,91,255,0.10) 0%, rgba(47,91,255,0) 70%)",
        }}
      />
      {/* warm glow, lower-left */}
      <div
        aria-hidden
        className="absolute left-[-8vw] bottom-[-10vh] h-[50vh] w-[50vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(228,30,43,0.10) 0%, rgba(228,30,43,0) 70%)",
        }}
      />

      {/* header */}
      <div className="absolute top-[14vh] left-[5vw] right-[5vw]">
        <motion.div
          className="mb-[3vh]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
            The Proof
          </span>
        </motion.div>

        <motion.h1
          className="font-display font-light tracking-[-0.025em] text-[3.6vw] leading-[1.04] text-text"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
        >
          Belief. Utility.{" "}
          <span className="text-red font-normal">Commitment.</span>
        </motion.h1>
      </div>

      {/* three signal cards */}
      <div className="absolute left-[5vw] right-[5vw] top-[35vh] grid grid-cols-3 gap-[2vw]">
        {SIGNALS.map((s, i) => (
          <motion.div
            key={s.label}
            className="relative overflow-hidden rounded-[14px] border border-text/[0.08] bg-cream/55 px-[2vw] py-[3.4vh] backdrop-blur-[3px] shadow-[0_2px_22px_-14px_rgba(26,24,19,0.55)]"
            initial={reduce ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.3 + i * 0.12 }
            }
          >
            <span
              aria-hidden
              className={`absolute inset-x-0 top-0 h-[4px] ${toneBg(s.tone)}`}
            />
            <div
              className={`font-display uppercase tracking-[0.22em] text-[0.82vw] font-semibold ${toneText(
                s.tone,
              )}`}
            >
              {s.frame}
            </div>
            <div
              className={`mt-[1.6vh] font-display font-light tabular-nums leading-none text-[5vw] ${toneText(
                s.tone,
              )}`}
            >
              {s.metric}
            </div>
            <div className="mt-[2vh] font-body uppercase tracking-[0.2em] text-[0.85vw] text-text/55 font-medium">
              {s.label}
            </div>
            <div
              className={`mt-[2.6vh] font-display font-semibold tracking-[-0.01em] text-[1.7vw] leading-none ${toneText(
                s.tone,
              )}`}
            >
              {s.tag}
            </div>
          </motion.div>
        ))}
      </div>

      {/* closing band */}
      <motion.div
        className="absolute bottom-[8.5vh] left-[5vw] right-[5vw] flex items-center gap-[1.4vw]"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.8 }}
      >
        <span className="block w-[3.6vw] h-[3px] bg-red shrink-0" />
        <p className="font-display font-light tracking-[-0.015em] text-[2.5vw] leading-[1.2] text-text/85">
          Belief drives retention. Retention drives membership.{" "}
          <span className="text-text font-normal">Membership drives recurring revenue.</span>
        </p>
      </motion.div>
    </SlideFrame>
  );
}
