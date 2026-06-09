import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";
import Wordmark from "@/components/Wordmark";

const EASE = [0.16, 1, 0.3, 1] as const;

type Tone = "ink" | "red" | "blue";

const toneText = (t: Tone) =>
  t === "red" ? "text-red" : t === "blue" ? "text-blue" : "text-text";

// The three truths the laboratory proves — restated as the parting note.
const TRUTHS: Array<{ lead: string; key: string; tone: Tone }> = [
  { lead: "Brickell is the", key: "laboratory", tone: "ink" },
  { lead: "The GTM is the", key: "proof sequence", tone: "red" },
  { lead: "The OS is the", key: "valuation multiplier", tone: "blue" },
];

const FOUNDERS: Array<{
  name: string;
  role: string;
  email: string;
  phone?: string;
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
    <SlideFrame slide={24} phaseLabel="The Invitation" hideTopWordmark>
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
        {/* eyebrow */}
        <motion.div className="mb-[2.4vh]" {...reveal(0)}>
          <span className="font-display uppercase tracking-[0.34em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
            Contact
          </span>
        </motion.div>

        {/* headline */}
        <motion.h1
          className="font-display font-light tracking-[-0.025em] text-[2.5vw] leading-[1.1] text-text max-w-[62vw]"
          {...reveal(0.08)}
        >
          Join us before the{" "}
          <span className="text-red font-normal">national stage.</span>
        </motion.h1>

        {/* body — two columns */}
        <div className="mt-[5vh] flex-1 flex gap-[4vw]">
          {/* LEFT — the mission */}
          <motion.div className="w-[55%] flex flex-col" {...reveal(0.28)}>
            <span className="font-display uppercase tracking-[0.3em] text-[0.62vw] text-text/40 font-semibold mb-[2.4vh]">
              The Mission
            </span>

            <p className="font-display font-light tracking-[-0.02em] text-[1.8vw] leading-[1.16] text-text">
              Performance is{" "}
              <span className="text-text font-normal">non-negotiable.</span>
            </p>

            <p className="mt-[2.6vh] font-display font-light tracking-[-0.012em] text-[1.18vw] leading-[1.4] text-text/55 max-w-[36vw]">
              We are not building a beverage company. We are proving that a
              readiness ritual can become a{" "}
              <span className="text-blue font-medium">
                recurring membership business.
              </span>
            </p>

            {/* the three truths */}
            <div className="mt-[4.5vh] flex flex-col gap-[1.6vh]">
              {TRUTHS.map((t) => (
                <p
                  key={t.key}
                  className="font-display tracking-[-0.01em] text-[1.15vw] leading-[1.1]"
                >
                  <span className="text-text/40 font-light">{t.lead} </span>
                  <span className={`${toneText(t.tone)} font-semibold`}>
                    {t.key}
                  </span>
                  <span className="text-text/40 font-light">.</span>
                </p>
              ))}
            </div>
          </motion.div>

          {/* RIGHT — contact card */}
          <motion.div
            className="w-[45%] flex flex-col border-l border-text/15 pl-[3vw]"
            {...reveal(0.42)}
          >
            {/* AForce — founders */}
            <span className="font-display uppercase tracking-[0.3em] text-[0.62vw] text-red font-semibold mb-[2vh]">
              AForce
            </span>

            <div className="flex flex-col gap-[2.4vh]">
              {FOUNDERS.map((f) => (
                <div key={f.email}>
                  <div className="flex items-baseline gap-[0.8vw]">
                    <span className="font-display font-medium tracking-[-0.01em] text-[1.25vw] text-text leading-none">
                      {f.name}
                    </span>
                    <span className="font-display uppercase tracking-[0.2em] text-[0.58vw] text-text/45 font-semibold">
                      {f.role}
                    </span>
                  </div>
                  <div className="mt-[0.9vh] flex items-center gap-[1.2vw]">
                    <span className="font-body text-[0.92vw] text-blue tracking-[-0.005em]">
                      {f.email}
                    </span>
                    {f.phone && (
                      <span className="font-body text-[0.92vw] text-text/65 tabular-nums">
                        {f.phone}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* headquarters */}
            <div className="mt-[3vh] pt-[3vh] border-t border-text/12">
              <span className="font-display uppercase tracking-[0.3em] text-[0.58vw] text-text/40 font-semibold">
                Headquarters
              </span>
              <p className="mt-[1.1vh] font-body text-[0.95vw] leading-[1.5] text-text/75">
                535 Fifth Avenue, 4th Floor #1004
                <br />
                New York, NY 10017
              </p>
            </div>

            {/* learn more */}
            <div className="mt-[3vh] pt-[3vh] border-t border-text/12">
              <span className="font-display uppercase tracking-[0.3em] text-[0.58vw] text-text/40 font-semibold">
                Learn More
              </span>
              <div className="mt-[1.1vh] flex flex-col gap-[0.7vh]">
                <span className="font-display font-medium text-[1.05vw] text-text tracking-[-0.01em]">
                  www.drinkaforce.com
                </span>
                <span className="font-body text-[0.9vw] text-text/55">
                  Investor deck ·{" "}
                  <span className="text-blue font-medium">
                    invest.drinkaforce.com
                  </span>
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* BOTTOM BAND — big wordmark + tagline */}
      <motion.div
        className="absolute bottom-[8.5vh] left-[5vw] right-[5vw] z-[5] flex items-end justify-between gap-[3vw] border-t border-text/15 pt-[2.2vh]"
        {...reveal(0.6)}
      >
        <Wordmark className="h-[2.4vw]" />
        <p className="font-display font-medium tracking-[-0.015em] text-[1.15vw] leading-none text-text/70">
          Built for people who don&apos;t get to be{" "}
          <span className="text-red font-semibold">off.</span>
        </p>
      </motion.div>
    </SlideFrame>
  );
}
