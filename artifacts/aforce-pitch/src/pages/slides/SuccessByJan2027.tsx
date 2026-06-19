import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

type Tone = "ink" | "red" | "blue";

const KPIS: Array<{ value: string; label: string; tone: Tone }> = [
  { value: "1,000", label: "Active OS Users", tone: "ink" },
  { value: "600", label: "Daily Active Users", tone: "ink" },
  { value: "60+", label: "NPS", tone: "red" },
  { value: "60%+", label: "60-Day Retention", tone: "blue" },
  { value: "20%+", label: "Membership Conversion", tone: "blue" },
  { value: "250", label: "Brickell Event Attendees", tone: "ink" },
  { value: "21", label: "Average Streak · Days", tone: "red" },
];

const toneText = (t: Tone) =>
  t === "red" ? "text-red" : t === "blue" ? "text-blue" : "text-text";

export default function SuccessByJan2027() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={19}>
      {/* cool accent halo, upper-right */}
      <div
        aria-hidden
        className="absolute right-[-6vw] top-[4vh] h-[44vh] w-[44vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(47,91,255,0.09) 0%, rgba(47,91,255,0) 70%)",
        }}
      />

      {/* header */}
      <div className="absolute top-[13vh] left-[5vw] right-[5vw]">
        <motion.div
          className="mb-[2.6vh]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
            The Target
          </span>
        </motion.div>

        <motion.h1
          className="font-display font-light tracking-[-0.025em] text-[3.2vw] leading-[1.04] text-text"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
        >
          What success looks like by{" "}
          <span className="text-red font-normal">January 2027.</span>
        </motion.h1>
      </div>

      {/* KPI grid: 7 targets + 1 thesis tile */}
      <div className="absolute left-[5vw] right-[5vw] top-[30vh] bottom-[8vh] grid grid-cols-4 grid-rows-2 gap-[1.4vw]">
        {KPIS.map((k, i) => (
          <motion.div
            key={k.label}
            className="relative flex flex-col justify-center overflow-hidden rounded-[12px] border border-text/[0.08] bg-cream/55 px-[1.6vw] backdrop-blur-[3px] shadow-[0_2px_18px_-13px_rgba(26,24,19,0.5)]"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.28 + i * 0.07 }
            }
          >
            <div
              className={`font-display font-light tabular-nums leading-none text-[3.4vw] ${toneText(
                k.tone,
              )}`}
            >
              {k.value}
            </div>
            <div className="mt-[1.6vh] font-body uppercase tracking-[0.18em] text-[0.74vw] text-text/55 font-medium leading-[1.3]">
              {k.label}
            </div>
          </motion.div>
        ))}

        {/* thesis tile */}
        <motion.div
          className="relative flex flex-col justify-center overflow-hidden rounded-[12px] bg-red px-[1.6vw] py-[2vh] shadow-[0_6px_28px_-14px_rgba(228,30,43,0.65)]"
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reduce
              ? undefined
              : { duration: 0.5, ease: EASE, delay: 0.28 + KPIS.length * 0.07 }
          }
        >
          <p className="font-display font-medium tracking-[-0.01em] text-[1.02vw] leading-[1.32] text-cream">
            If these are achieved, AForce has proven a readiness ritual can become a{" "}
            <span className="font-semibold">recurring membership business.</span>
          </p>
        </motion.div>
      </div>
    </SlideFrame>
  );
}
