import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

type Tone = "ink" | "red" | "blue";

type Step = { w: string; d: string; tone: Tone };

const JOURNEY: Step[] = [
  { w: "Discover", d: "Retail · Amazon · Social · Events", tone: "red" },
  { w: "Purchase", d: "First can or hydration stick", tone: "red" },
  { w: "Activate", d: "Scan QR → join AForce OS", tone: "ink" },
  { w: "Ritual", d: "Pause · Hydrate · Lock In · Perform", tone: "ink" },
  { w: "Behavior", d: "Daily streaks · protocols · challenges", tone: "ink" },
  { w: "Results", d: "Better focus · energy · consistency", tone: "ink" },
  { w: "Athlete Mode", d: "21-day milestone achieved", tone: "red" },
  { w: "Membership", d: "Product + OS + community", tone: "blue" },
  { w: "Advocate", d: "Referrals · ambassadors · growth", tone: "blue" },
];

const ROW1 = JOURNEY.slice(0, 5);
const ROW2 = JOURNEY.slice(5);

const LOOP = [
  { w: "Product", tone: "ink" as Tone },
  { w: "Ritual", tone: "ink" as Tone },
  { w: "Behavior", tone: "ink" as Tone },
  { w: "OS", tone: "ink" as Tone },
  { w: "Retention", tone: "ink" as Tone },
  { w: "Membership", tone: "blue" as Tone },
  { w: "Advocacy", tone: "ink" as Tone },
  { w: "Scale", tone: "red" as Tone },
];

const METRICS = [
  { v: "NPS 60+", l: "Belief", tone: "red" as Tone },
  { v: "60-Day Retention 60%+", l: "People stay", tone: "ink" as Tone },
  { v: "Membership Conversion 20%+", l: "Commitment", tone: "blue" as Tone },
];

const toneText = (t: Tone) =>
  t === "red" ? "text-red" : t === "blue" ? "text-blue" : "text-text";
const toneDot = (t: Tone) =>
  t === "red" ? "bg-red" : t === "blue" ? "bg-blue" : "bg-text/70";

function Row({
  steps,
  startIndex,
  delay,
  rail,
  reduce,
}: {
  steps: Step[];
  startIndex: number;
  delay: number;
  rail: string;
  reduce: boolean;
}) {
  const cols = steps.length;
  return (
    <div className="relative">
      {/* connecting rail behind the nodes */}
      <div
        className={`absolute top-[0.5vw] h-[2px] bg-text/12 ${rail}`}
        aria-hidden
      />
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {steps.map((s, i) => (
          <motion.div
            key={s.w}
            className="relative flex flex-col items-center text-center px-[0.9vw]"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduce ? undefined : { duration: 0.5, ease: EASE, delay: delay + i * 0.1 }
            }
          >
            <span
              className={`relative z-10 w-[1vw] h-[1vw] rounded-full ring-[0.32vw] ring-bg ${toneDot(
                s.tone,
              )}`}
            />
            <span className="mt-[1.4vh] font-display tracking-[0.22em] text-[0.58vw] text-text/35 font-semibold">
              {String(startIndex + i).padStart(2, "0")}
            </span>
            <span
              className={`mt-[0.7vh] font-display font-light tracking-[-0.01em] leading-none text-[1.32vw] ${toneText(
                s.tone,
              )}`}
            >
              {s.w}
            </span>
            <span className="mt-[1vh] font-body leading-[1.4] text-[0.72vw] text-text/55 max-w-[12vw]">
              {s.d}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default function CustomerJourney() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={17} phaseLabel="The Journey">
      {/* cool accent halo, lower-left — the loop closing */}
      <div
        aria-hidden
        className="absolute left-[-8vw] bottom-[-10vh] h-[46vh] w-[46vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(47,91,255,0.10) 0%, rgba(47,91,255,0) 68%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col px-[5vw] pt-[11vh] pb-[8.5vh]">
        {/* HEADER */}
        <div>
          <motion.div
            className="mb-[2.6vh]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
          >
            <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
              Customer Journey
            </span>
          </motion.div>

          <motion.h1
            className="font-display font-light tracking-[-0.025em] text-[3.3vw] leading-[1.04] text-text"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
          >
            From first sip to{" "}
            <span className="text-blue font-normal">membership.</span>
          </motion.h1>

          <motion.p
            className="mt-[1.6vh] font-body text-[0.95vw] leading-[1.5] text-text/55"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.16 }}
          >
            The AForce performance journey.
          </motion.p>
        </div>

        {/* JOURNEY — two-row flow */}
        <div className="mt-[4vh] flex-1 flex flex-col justify-center">
          <Row steps={ROW1} startIndex={1} delay={0.3} rail="left-[10%] right-[10%]" reduce={reduce} />

          {/* down connector between rows */}
          <motion.div
            className="flex justify-center my-[1.8vh]"
            aria-hidden
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.82 }}
          >
            <svg width="14" height="22" viewBox="0 0 14 22" fill="none">
              <path
                d="M7 0 V18 M1.5 12.5 L7 19 L12.5 12.5"
                stroke="#2f5bff"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>

          <Row steps={ROW2} startIndex={6} delay={0.95} rail="left-[12.5%] right-[12.5%]" reduce={reduce} />
        </div>

        {/* BOTTOM BAND — compounding loop + proof metrics */}
        <motion.div
          className="mt-[3vh] border-t border-text/15 pt-[2.4vh]"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 1.35 }}
        >
          <div className="flex items-center justify-between gap-[3vw]">
            {/* loop chain */}
            <div className="flex flex-col gap-[1.1vh]">
              <span className="font-display uppercase tracking-[0.3em] text-[0.6vw] text-red font-semibold">
                The Compounding Loop
              </span>
              <div className="flex flex-wrap items-baseline gap-x-[0.55vw] gap-y-[0.4vh] font-display text-[1.05vw] leading-none">
                {LOOP.map((n, i) => (
                  <span key={n.w} className="flex items-baseline gap-x-[0.55vw]">
                    <span className={`${toneText(n.tone)} ${n.tone === "ink" ? "text-text/75 font-light" : "font-normal"}`}>
                      {n.w}
                    </span>
                    {i < LOOP.length - 1 && (
                      <span className="text-text/25" aria-hidden>
                        →
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>

            {/* proof metrics */}
            <div className="flex flex-col gap-[1.1vh] items-end">
              <span className="font-display uppercase tracking-[0.3em] text-[0.6vw] text-blue font-semibold">
                Proof Metrics
              </span>
              <div className="flex items-stretch gap-[1.6vw]">
                {METRICS.map((m, i) => (
                  <div
                    key={m.v}
                    className={`flex flex-col ${i > 0 ? "pl-[1.6vw] border-l border-text/15" : ""}`}
                  >
                    <span className={`font-display font-normal tracking-[-0.01em] text-[0.98vw] leading-none ${toneText(m.tone)}`}>
                      {m.v}
                    </span>
                    <span className="mt-[0.7vh] font-display uppercase tracking-[0.24em] text-[0.54vw] text-text/40 font-semibold">
                      {m.l}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </SlideFrame>
  );
}
