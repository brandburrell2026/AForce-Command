import { Fragment } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

type Tone = "ink" | "red" | "blue";

type Stage = {
  n: string;
  k: string;
  tone: Tone;
  name?: string;
  items?: string[];
  goal: string;
  hero?: boolean;
  sub?: string;
  callout?: string;
};

const RITUAL_WORDS = ["Pause.", "Hydrate.", "Lock In.", "Perform."];

// Five stages — trial to recurring revenue. Color flows red → ink → blue.
const STAGES: Stage[] = [
  {
    n: "01",
    k: "Discover",
    tone: "red",
    name: "First Sip",
    items: ["Retail", "Amazon", "Events", "Referrals"],
    goal: "Trial",
  },
  {
    n: "02",
    k: "Activate",
    tone: "red",
    name: "Scan & Join",
    items: ["Scan QR code", "Create AForce OS account", "Readiness assessment"],
    goal: "Activation",
  },
  {
    n: "03",
    k: "The Ritual",
    tone: "ink",
    hero: true,
    sub: "Morning Stick → Midday Can → Daily Readiness Protocol",
    goal: "Habit Formation",
  },
  {
    n: "04",
    k: "Build Behavior",
    tone: "blue",
    name: "Build Behavior",
    items: [
      "Daily streaks",
      "Protocol completion",
      "Readiness tracking",
      "Challenges",
      "Founder content",
    ],
    goal: "Retention",
    callout: "Behavior becomes habit.",
  },
  {
    n: "05",
    k: "Membership",
    tone: "blue",
    name: "Membership",
    items: [
      "Premium AForce OS",
      "Monthly product allocation",
      "Community access",
      "Events & experiences",
      "Advanced protocols",
    ],
    goal: "Recurring Revenue",
    callout: "Habit becomes membership.",
  },
];

// One day, on repeat.
const DAILY = [
  {
    t: "Morning",
    p: "Hydration Stick",
    items: ["Readiness check", "Daily protocol", "Performance goal"],
  },
  {
    t: "Midday",
    p: "AForce Can",
    items: ["Energy support", "Hydration reminder", "Streak tracking"],
  },
  {
    t: "Evening",
    p: "AForce OS",
    items: ["Recovery protocol", "Progress review", "Next-day prep"],
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
  const reveal = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 } as const,
    transition: reduce ? undefined : { duration: 0.55, ease: EASE, delay },
  });

  return (
    <SlideFrame slide={12} phaseLabel="The Journey">
      {/* flow glows — warm acquisition (left) cooling into retention (right) */}
      <div
        aria-hidden
        className="absolute left-[-8vw] top-[4vh] h-[40vh] w-[40vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(228,30,43,0.09) 0%, rgba(228,30,43,0) 68%)",
        }}
      />
      <div
        aria-hidden
        className="absolute right-[-8vw] bottom-[-10vh] h-[46vh] w-[46vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(47,91,255,0.11) 0%, rgba(47,91,255,0) 68%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col px-[4vw] pt-[7.5vh] pb-[10vh]">
        {/* HEADER */}
        <div className="flex items-end justify-between gap-[4vw]">
          <div>
            <motion.span
              className="block mb-[1.8vh] font-display uppercase tracking-[0.32em] text-[0.74vw] text-red font-semibold border-b-2 border-red pb-[0.5vh] w-fit"
              {...reveal(0)}
            >
              Customer Journey
            </motion.span>
            <motion.h1
              className="font-display font-light tracking-[-0.025em] text-[2.7vw] leading-[1.02] text-text"
              {...reveal(0.08)}
            >
              From first sip to{" "}
              <span className="text-blue font-normal">membership.</span>
            </motion.h1>
          </div>

          <motion.div
            className="hidden md:flex flex-col items-end text-right pb-[0.4vh]"
            {...reveal(0.18)}
          >
            <span className="font-display uppercase tracking-[0.26em] text-[0.6vw] text-text/40 font-semibold">
              One journey
            </span>
            <span className="mt-[0.7vh] font-display font-light tracking-[-0.01em] text-[1vw] leading-none">
              <span className="text-red">Morning</span>
              <span className="text-text/30"> · </span>
              <span className="text-text">Midday</span>
              <span className="text-text/30"> · </span>
              <span className="text-text">Evening</span>
              <span className="text-text/30"> · </span>
              <span className="text-blue">Membership</span>
            </span>
          </motion.div>
        </div>

        {/* TIMELINE — five stages */}
        <div className="mt-[3vh] relative">
          {/* value rail, red → ink → blue */}
          <motion.div
            aria-hidden
            className="absolute left-0 right-0 top-[0.5vw] h-[2px] origin-left"
            style={{
              background:
                "linear-gradient(90deg, #e41e2b 0%, #e41e2b 16%, rgba(20,20,20,0.4) 50%, #2f5bff 84%, #2f5bff 100%)",
            }}
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={reduce ? undefined : { duration: 0.9, ease: EASE, delay: 0.3 }}
          />

          <div className="grid grid-cols-5">
            {STAGES.map((s, si) => (
              <motion.div
                key={s.n}
                className="relative pr-[1.8vw]"
                {...reveal(0.4 + si * 0.1)}
              >
                {/* hero wash behind the ritual */}
                {s.hero && (
                  <div
                    aria-hidden
                    className="absolute -left-[0.4vw] right-[1.2vw] top-[1.6vw] bottom-[-1vh] rounded-[0.4vw]"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(228,30,43,0) 0%, rgba(228,30,43,0.06) 100%)",
                    }}
                  />
                )}

                {/* station marker */}
                <div className="relative z-10 h-[1vw]">
                  <span
                    className={`absolute left-0 top-0 h-[1vw] w-[1vw] rounded-full ring-[0.34vw] ring-bg ${toneDot(
                      s.tone,
                    )}`}
                  />
                </div>

                {/* kicker */}
                <span
                  className={`relative z-10 mt-[2.2vh] block font-display uppercase tracking-[0.22em] text-[0.74vw] font-bold ${toneText(
                    s.tone,
                  )}`}
                >
                  <span className="text-text/30">{s.n}</span> {s.k}
                </span>

                {s.hero ? (
                  <div className="relative z-10 mt-[2vh]">
                    <div className="flex flex-col gap-[0.4vh]">
                      {RITUAL_WORDS.map((rw) => (
                        <span
                          key={rw}
                          className="font-display font-bold uppercase tracking-[0.01em] leading-[1.02] text-[1.6vw] text-red"
                        >
                          {rw}
                        </span>
                      ))}
                    </div>
                    <p className="mt-[1.8vh] font-body leading-[1.5] text-[0.78vw] text-text/55 max-w-[15vw]">
                      {s.sub}
                    </p>
                  </div>
                ) : (
                  <>
                    <span className="relative z-10 mt-[1.6vh] block font-display font-normal tracking-[-0.01em] leading-none text-[1.4vw] text-text">
                      {s.name}
                    </span>
                    <ul className="relative z-10 mt-[1.6vh] flex flex-col gap-[0.7vh]">
                      {s.items?.map((it) => (
                        <li
                          key={it}
                          className="flex items-baseline gap-[0.55vw] font-body text-[0.78vw] leading-[1.35] text-text/60"
                        >
                          <span
                            className={`mt-[0.5vh] h-[0.28vw] w-[0.28vw] shrink-0 rounded-full ${toneDot(
                              s.tone,
                            )}`}
                          />
                          {it}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {/* goal */}
                <div className="relative z-10 mt-[2vh]">
                  <span className="font-display uppercase tracking-[0.24em] text-[0.56vw] text-text/35 font-semibold">
                    Goal
                  </span>
                  <span
                    className={`mt-[0.4vh] block font-display font-medium tracking-[-0.01em] text-[0.96vw] leading-none ${toneText(
                      s.tone,
                    )}`}
                  >
                    {s.goal}
                  </span>
                  {s.callout && (
                    <span className="mt-[0.9vh] block font-display italic text-[0.74vw] text-text/45">
                      {s.callout}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* DAILY JOURNEY — one day, on repeat */}
        <motion.div className="mt-[3vh]" {...reveal(0.95)}>
          <span className="block mb-[1.4vh] font-display uppercase tracking-[0.3em] text-[0.72vw] text-text/45 font-semibold">
            One Day · On Repeat
          </span>
          <div className="flex items-stretch">
            {DAILY.map((d, di) => (
              <Fragment key={d.t}>
                <div className="flex-1 rounded-[0.5vw] border border-text/10 bg-text/[0.015] px-[1.5vw] py-[1.6vh]">
                  <div className="flex items-baseline justify-between gap-[1vw]">
                    <span className="font-display uppercase tracking-[0.26em] text-[0.62vw] text-red font-semibold">
                      {d.t}
                    </span>
                    <span className="font-display font-normal tracking-[-0.01em] text-[1.05vw] text-text leading-none">
                      {d.p}
                    </span>
                  </div>
                  <div className="mt-[1.2vh] flex flex-wrap gap-x-[1.2vw] gap-y-[0.5vh]">
                    {d.items.map((it) => (
                      <span
                        key={it}
                        className="font-body text-[0.74vw] leading-none text-text/55"
                      >
                        {it}
                      </span>
                    ))}
                  </div>
                </div>
                {di < DAILY.length - 1 && (
                  <div className="flex items-center px-[0.9vw]">
                    <span className="font-display text-[1.3vw] text-text/25" aria-hidden>
                      →
                    </span>
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </motion.div>

        {/* BOTTOM BAND — compounding loop + proof metrics */}
        <motion.div
          className="mt-auto pt-[2.4vh] border-t border-text/15"
          {...reveal(1.15)}
        >
          <div className="flex items-end justify-between gap-[3vw]">
            <div className="flex flex-col gap-[1.2vh]">
              <span className="font-display uppercase tracking-[0.3em] text-[0.74vw] text-red font-semibold">
                The Compounding Loop
              </span>
              <div className="flex flex-wrap items-baseline gap-x-[1.3vw] gap-y-[0.4vh] font-display text-[0.86vw] leading-none">
                {COMPOUNDS.map((c) => (
                  <span key={c.a} className="text-text/45 font-light">
                    {c.a} creates{" "}
                    <span className="text-text/75 font-normal">{c.b}</span>.
                  </span>
                ))}
              </div>
              <div className="mt-[0.3vh] flex items-baseline gap-x-[0.55vw] font-display text-[1.05vw] leading-none whitespace-nowrap">
                {LOOP.map((n, i) => (
                  <span key={n.w} className="flex items-baseline gap-x-[0.55vw]">
                    <span
                      className={`${toneText(n.tone)} ${n.tone === "ink" ? "text-text/75 font-light" : "font-normal"}`}
                    >
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

            <div className="flex flex-col gap-[1.2vh] items-end">
              <span className="font-display uppercase tracking-[0.3em] text-[0.74vw] text-blue font-semibold">
                Proof Metrics
              </span>
              <div className="flex items-stretch gap-[1.8vw]">
                {METRICS.map((m, i) => (
                  <div
                    key={m.v}
                    className={`flex flex-col ${i > 0 ? "pl-[1.8vw] border-l border-text/15" : ""}`}
                  >
                    <span
                      className={`font-display font-normal tracking-[-0.01em] text-[1vw] leading-none whitespace-nowrap ${toneText(m.tone)}`}
                    >
                      {m.v}
                    </span>
                    <span className="mt-[0.8vh] font-display uppercase tracking-[0.22em] text-[0.6vw] text-text/40 font-semibold">
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
