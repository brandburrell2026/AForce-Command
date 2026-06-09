import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

type Tone = "ink" | "red" | "blue";

type Step = { i: string; w: string; d: string; hero?: boolean };
type Phase = {
  n: string;
  title: string;
  tone: Tone;
  steps: Step[];
  note?: string;
};

// The ritual — the core behavior that drives the entire model.
const RITUAL_WORDS = ["Pause.", "Hydrate.", "Lock In.", "Perform."];

// Nine steps, grouped into the five-phase value funnel.
// Color flows red (acquisition) → ink (the OS) → blue (retention · membership).
const PHASES: Phase[] = [
  {
    n: "01",
    title: "Acquire",
    tone: "red",
    steps: [
      { i: "01", w: "Discover", d: "DTC · Amazon · Social · Events" },
      { i: "02", w: "Purchase", d: "First can or hydration stick" },
    ],
  },
  {
    n: "02",
    title: "Activate",
    tone: "ink",
    steps: [
      { i: "03", w: "Activate", d: "Scan QR → join AForce OS" },
      { i: "04", w: "Ritual", d: "", hero: true },
    ],
  },
  {
    n: "03",
    title: "Compound",
    tone: "ink",
    steps: [
      { i: "05", w: "Behavior", d: "Daily streaks · protocols · challenges" },
      { i: "06", w: "Results", d: "Better focus · energy · consistency" },
    ],
  },
  {
    n: "04",
    title: "Convert",
    tone: "blue",
    note: "Readiness creates commitment",
    steps: [
      { i: "07", w: "Readiness Mode", d: "21-day readiness milestone · protocols · tracking · community" },
      { i: "08", w: "Membership", d: "Product + OS + community" },
    ],
  },
  {
    n: "05",
    title: "Expand",
    tone: "blue",
    steps: [{ i: "09", w: "Advocate", d: "Referrals · ambassadors · growth" }],
  },
];

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

// Plain-language reading of the loop — how value compounds, stage by stage.
const COMPOUNDS = [
  { a: "Product", b: "entry" },
  { a: "Ritual", b: "behavior" },
  { a: "Behavior", b: "retention" },
  { a: "Retention", b: "membership" },
  { a: "Membership", b: "advocacy" },
];

const METRICS = [
  { v: "NPS 60+", l: "People believe", tone: "red" as Tone },
  { v: "60-Day Retention 60%+", l: "People stay", tone: "ink" as Tone },
  { v: "Membership Conversion 20%+", l: "People commit", tone: "blue" as Tone },
];

const toneText = (t: Tone) =>
  t === "red" ? "text-red" : t === "blue" ? "text-blue" : "text-text";
const toneDot = (t: Tone) =>
  t === "red" ? "bg-red" : t === "blue" ? "bg-blue" : "bg-text/70";

export default function CustomerJourney() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={12} phaseLabel="The Journey">
      {/* flow glows — warm acquisition (left) cooling into retention (right) */}
      <div
        aria-hidden
        className="absolute left-[-8vw] top-[6vh] h-[42vh] w-[42vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(228,30,43,0.10) 0%, rgba(228,30,43,0) 68%)",
        }}
      />
      <div
        aria-hidden
        className="absolute right-[-8vw] bottom-[-10vh] h-[48vh] w-[48vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(47,91,255,0.12) 0%, rgba(47,91,255,0) 68%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col px-[5vw] pt-[10vh] pb-[8.5vh]">
        {/* HEADER */}
        <div className="flex items-end justify-between gap-[4vw]">
          <div>
            <motion.div
              className="mb-[2.4vh]"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
            >
              <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
                Customer Journey
              </span>
            </motion.div>

            <motion.h1
              className="font-display font-light tracking-[-0.025em] text-[3.5vw] leading-[1.02] text-text"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
            >
              From first sip to{" "}
              <span className="text-blue font-normal">membership.</span>
            </motion.h1>
          </div>

          {/* right kicker — the shape of the journey */}
          <motion.div
            className="hidden md:flex flex-col items-end text-right pb-[0.6vh]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.2 }}
          >
            <span className="font-display uppercase tracking-[0.26em] text-[0.62vw] text-text/40 font-semibold">
              One journey
            </span>
            <span className="mt-[0.8vh] font-display font-light tracking-[-0.01em] text-[1.15vw] leading-none">
              <span className="text-text">9 steps</span>
              <span className="text-text/30"> · </span>
              <span className="text-text">5 phases</span>
              <span className="text-text/30"> · </span>
              <span className="text-red font-normal">1 ritual</span>
              <span className="text-text/30"> · </span>
              <span className="text-blue">1 loop</span>
            </span>
          </motion.div>
        </div>

        {/* PHASES — the value funnel */}
        <div className="mt-[3.5vh] flex-1 relative">
          {/* continuous value rail, red → ink → blue */}
          <motion.div
            aria-hidden
            className="absolute left-0 right-0 top-[0.5vw] h-[2px] origin-left"
            style={{
              background:
                "linear-gradient(90deg, #e41e2b 0%, #e41e2b 16%, rgba(20,20,20,0.45) 50%, #2f5bff 84%, #2f5bff 100%)",
            }}
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={reduce ? undefined : { duration: 1, ease: EASE, delay: 0.3 }}
          />

          <div className="grid grid-cols-5 h-full">
            {PHASES.map((phase, pi) => {
              const wash =
                phase.tone === "red"
                  ? "rgba(228,30,43,0.05)"
                  : phase.tone === "blue"
                    ? "rgba(47,91,255,0.06)"
                    : "rgba(20,20,20,0.035)";
              return (
                <motion.div
                  key={phase.title}
                  className="relative h-full pr-[2vw]"
                  initial={reduce ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    reduce
                      ? undefined
                      : { duration: 0.55, ease: EASE, delay: 0.45 + pi * 0.12 }
                  }
                >
                  {/* soft tone wash — gives each phase vertical presence */}
                  <div
                    aria-hidden
                    className="absolute left-0 right-[2vw] bottom-0 h-[64%] rounded-t-[0.4vw]"
                    style={{
                      background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, ${wash} 100%)`,
                    }}
                  />

                  {/* oversized ghost numeral — editorial scale */}
                  <span
                    aria-hidden
                    className="pointer-events-none select-none absolute right-[2.3vw] bottom-[1vh] font-display font-extralight leading-[0.8] text-[8.5vw] text-text/[0.05]"
                  >
                    {phase.n}
                  </span>

                  {/* station marker on the rail */}
                  <div className="relative z-10 h-[1vw]">
                    <span
                      className={`absolute left-0 top-0 h-[1vw] w-[1vw] rounded-full ring-[0.34vw] ring-bg ${toneDot(
                        phase.tone,
                      )}`}
                    />
                  </div>

                  {/* phase label */}
                  <span
                    className={`relative z-10 mt-[2.6vh] block font-display uppercase tracking-[0.26em] text-[1.04vw] font-bold ${toneText(
                      phase.tone,
                    )}`}
                  >
                    {phase.title}
                  </span>

                  {/* steps */}
                  <div className="relative z-10 mt-[3.2vh] flex flex-col gap-[3vh]">
                    {phase.steps.map((s) =>
                      s.hero ? (
                        <div key={s.w}>
                          <div className="flex items-baseline gap-[0.7vw]">
                            <span className="font-display tracking-[0.2em] text-[0.66vw] text-red/50 font-semibold">
                              {s.i}
                            </span>
                            <span className="font-display uppercase tracking-[0.2em] text-[0.82vw] text-red font-bold">
                              The Ritual
                            </span>
                          </div>
                          <div className="mt-[1.6vh] flex flex-col gap-[0.5vh]">
                            {RITUAL_WORDS.map((rw) => (
                              <span
                                key={rw}
                                className="font-display font-bold uppercase tracking-[0.01em] leading-[1.04] text-[1.55vw] text-red"
                              >
                                {rw}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div key={s.w}>
                          <div className="flex items-baseline gap-[0.7vw]">
                            <span className="font-display tracking-[0.2em] text-[0.66vw] text-text/30 font-semibold">
                              {s.i}
                            </span>
                            <span className="font-display font-normal tracking-[-0.01em] leading-none text-[1.74vw] text-text">
                              {s.w}
                            </span>
                          </div>
                          <span className="mt-[1vh] block font-body leading-[1.45] text-[0.9vw] text-text/55 max-w-[13.5vw]">
                            {s.d}
                          </span>
                        </div>
                      ),
                    )}
                  </div>

                  {/* phase connector note */}
                  {phase.note && (
                    <span
                      className={`relative z-10 mt-[2.4vh] block font-display uppercase tracking-[0.22em] text-[0.62vw] font-semibold ${toneText(
                        phase.tone,
                      )}`}
                    >
                      {phase.note}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* BOTTOM BAND — compounding loop + proof metrics */}
        <motion.div
          className="mt-[2.6vh] border-t border-text/15 pt-[3vh]"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 1.35 }}
        >
          <div className="flex items-center justify-between gap-[3vw]">
            {/* loop chain */}
            <div className="flex flex-col gap-[1.4vh]">
              <span className="font-display uppercase tracking-[0.3em] text-[0.78vw] text-red font-semibold">
                How Value Compounds
              </span>
              <div className="flex flex-wrap items-baseline gap-x-[1.4vw] gap-y-[0.5vh] font-display text-[0.92vw] leading-none">
                {COMPOUNDS.map((c) => (
                  <span key={c.a} className="text-text/45 font-light">
                    {c.a} creates{" "}
                    <span className="text-text/75 font-normal">{c.b}</span>.
                  </span>
                ))}
              </div>
              <div className="mt-[0.4vh] flex flex-wrap items-baseline gap-x-[0.75vw] gap-y-[0.6vh] font-display text-[1.5vw] leading-none">
                {LOOP.map((n, i) => (
                  <span key={n.w} className="flex items-baseline gap-x-[0.75vw]">
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
            <div className="flex flex-col gap-[1.6vh] items-end">
              <span className="font-display uppercase tracking-[0.3em] text-[0.78vw] text-blue font-semibold">
                Proof Metrics
              </span>
              <div className="flex items-stretch gap-[2vw]">
                {METRICS.map((m, i) => (
                  <div
                    key={m.v}
                    className={`flex flex-col ${i > 0 ? "pl-[2vw] border-l border-text/15" : ""}`}
                  >
                    <span className={`font-display font-normal tracking-[-0.01em] text-[1.35vw] leading-none ${toneText(m.tone)}`}>
                      {m.v}
                    </span>
                    <span className="mt-[0.9vh] font-display uppercase tracking-[0.24em] text-[0.64vw] text-text/40 font-semibold">
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
