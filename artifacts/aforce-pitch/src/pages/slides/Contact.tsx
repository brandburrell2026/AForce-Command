import { Fragment } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";
import Wordmark from "@/components/Wordmark";

const EASE = [0.16, 1, 0.3, 1] as const;

type Tone = "ink" | "red" | "blue";

const toneText = (t: Tone) =>
  t === "red" ? "text-red" : t === "blue" ? "text-blue" : "text-text";

const toneDot = (t: Tone) =>
  t === "red" ? "bg-red" : t === "blue" ? "bg-blue" : "bg-text";

// The hero — the AForce ritual, color-coded to the brand system:
// red = PAUSE/acquisition, blue = LOCK IN/retention, ink = HYDRATE/PERFORM.
const RITUAL: Array<{ w: string; tone: Tone }> = [
  { w: "Pause", tone: "red" },
  { w: "Hydrate", tone: "ink" },
  { w: "Lock In", tone: "blue" },
  { w: "Perform", tone: "ink" },
];

// The compounding payoff — ritual into membership.
const BECOMES: Array<{ lead: string; key: string; tone: Tone }> = [
  { lead: "The ritual becomes", key: "behavior", tone: "ink" },
  { lead: "The behavior becomes", key: "belief", tone: "blue" },
  { lead: "The belief becomes", key: "membership", tone: "red" },
];

const FOUNDERS: Array<{
  name: string;
  role: string;
  email: string;
  phone: string;
}> = [
  {
    name: "Brandon Burrell",
    role: "Founder & CEO",
    email: "bburrell@alkalineforce.com",
    phone: "(205) 243-9447",
  },
  {
    name: "Julius Burrell",
    role: "Co-Founder",
    email: "jburrell@alkalineforce.com",
    phone: "(205) 563-6818",
  },
];

export default function Contact() {
  const reduce = useReducedMotion();

  const reveal = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 } as const,
    transition: reduce ? undefined : { duration: 0.6, ease: EASE, delay },
  });

  return (
    <SlideFrame slide={25} phaseLabel="The Invitation" hideTopWordmark>
      {/* acquisition glow lower-left, OS glow upper-right — the arc, one last time */}
      <div
        aria-hidden
        className="absolute left-[-8vw] bottom-[-10vh] h-[46vh] w-[46vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(228,30,43,0.10) 0%, rgba(228,30,43,0) 70%)",
        }}
      />
      <div
        aria-hidden
        className="absolute right-[-6vw] top-[2vh] h-[44vh] w-[44vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(47,91,255,0.09) 0%, rgba(47,91,255,0) 70%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col px-[5vw] pt-[11.5vh] pb-[9vh]">
        {/* headline */}
        <motion.h1
          className="font-display font-light tracking-[-0.025em] text-[1.85vw] leading-[1.1] text-text"
          {...reveal(0)}
        >
          Join us before the{" "}
          <span className="text-red font-normal">national stage.</span>
        </motion.h1>

        {/* body — ritual hero (left) + quiet info column (right) */}
        <div className="mt-[4.5vh] flex-1 flex gap-[4vw]">
          {/* LEFT — the ritual, the hero */}
          <div className="w-[55%] flex flex-col">
            <motion.span
              className="font-display uppercase tracking-[0.32em] text-[0.72vw] text-red font-semibold border-b-2 border-red pb-[0.6vh] self-start mb-[3.4vh]"
              {...reveal(0.12)}
            >
              The AForce Ritual
            </motion.span>

            {/* vertical rail of the four beats */}
            <div className="flex flex-col">
              {RITUAL.map((step, i) => (
                <Fragment key={step.w}>
                  <motion.div
                    className="flex items-center gap-[1.3vw]"
                    {...reveal(0.24 + i * 0.12)}
                  >
                    <span
                      className={`block h-[0.85vw] w-[0.85vw] rounded-full ${toneDot(
                        step.tone,
                      )} ${step.tone === "ink" ? "opacity-80" : ""}`}
                    />
                    <span
                      className={`font-display font-bold uppercase tracking-[0.02em] leading-none text-[2.5vw] ${toneText(
                        step.tone,
                      )}`}
                    >
                      {step.w}
                    </span>
                  </motion.div>
                  {i < RITUAL.length - 1 && (
                    <motion.span
                      aria-hidden
                      className="block w-[2px] h-[2.6vh] my-[0.5vh] ml-[0.4vw] bg-text/20"
                      {...reveal(0.3 + i * 0.12)}
                    />
                  )}
                </Fragment>
              ))}
            </div>

            {/* the compounding payoff */}
            <motion.div
              className="mt-[5vh] flex flex-col gap-[1.4vh]"
              {...reveal(0.78)}
            >
              {BECOMES.map((b) => (
                <p
                  key={b.key}
                  className="font-display tracking-[-0.01em] text-[1.2vw] leading-[1.1]"
                >
                  <span className="text-text/45 font-light">{b.lead} </span>
                  <span className={`${toneText(b.tone)} font-semibold`}>
                    {b.key}
                  </span>
                  <span className="text-text/45 font-light">.</span>
                </p>
              ))}
            </motion.div>
          </div>

          {/* RIGHT — quiet supporting column */}
          <motion.div
            className="w-[40%] ml-auto flex flex-col border-l border-text/15 pl-[3vw]"
            {...reveal(0.5)}
          >
            {/* national launch */}
            <span className="font-display uppercase tracking-[0.3em] text-[0.62vw] text-red font-semibold">
              January 2027
            </span>
            <p className="mt-[1.3vh] font-display font-light tracking-[-0.015em] text-[1.45vw] leading-[1.15] text-text">
              America&apos;s Real Deal
              <br />
              <span className="text-blue font-normal">national launch.</span>
            </p>
            <p className="mt-[1.4vh] font-body text-[0.9vw] leading-[1.45] text-text/55 max-w-[24vw]">
              Building the category leader in Performance Readiness.
            </p>

            {/* contact */}
            <div className="mt-[3.4vh] pt-[3.2vh] border-t border-text/12">
              <span className="font-display uppercase tracking-[0.3em] text-[0.62vw] text-text/40 font-semibold">
                Contact
              </span>
              <div className="mt-[1.8vh] flex flex-col gap-[1.8vh]">
                {FOUNDERS.map((f) => (
                  <div key={f.email}>
                    <div className="flex items-baseline gap-[0.7vw]">
                      <span className="font-display font-medium tracking-[-0.01em] text-[1.05vw] text-text leading-none">
                        {f.name}
                      </span>
                      <span className="font-display uppercase tracking-[0.18em] text-[0.54vw] text-text/45 font-semibold">
                        {f.role}
                      </span>
                    </div>
                    <div className="mt-[0.7vh] flex items-center gap-[1vw]">
                      <span className="font-body text-[0.82vw] text-blue tracking-[-0.005em]">
                        {f.email}
                      </span>
                      <span className="font-body text-[0.82vw] text-text/60 tabular-nums">
                        {f.phone}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* learn more */}
            <div className="mt-[2.8vh] pt-[2.8vh] border-t border-text/12 flex items-baseline gap-[1.2vw]">
              <span className="font-display font-medium text-[0.98vw] text-text tracking-[-0.01em]">
                www.drinkaforce.com
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* BOTTOM BAND — big wordmark + tagline */}
      <motion.div
        className="absolute bottom-[8.5vh] left-[5vw] right-[5vw] z-[5] flex items-end justify-between gap-[3vw] border-t border-text/15 pt-[2.2vh]"
        {...reveal(0.9)}
      >
        <Wordmark className="h-[2.4vw]" />
        <p className="font-display font-medium tracking-[-0.015em] text-[1.55vw] leading-none text-text/70">
          Built for people who don&apos;t get to be{" "}
          <span className="text-red font-semibold">off.</span>
        </p>
      </motion.div>
    </SlideFrame>
  );
}
