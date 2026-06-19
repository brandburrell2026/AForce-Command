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
    sub: "Morning Stick → Midday Drink → AForce OS",
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
  },
];

// The AForce system — three products, three moments.
type Product = {
  time: string;
  name: string;
  tagline: string;
  items: string[];
  img: string;
  tone: Tone;
};

const PRODUCTS: Product[] = [
  {
    time: "Morning",
    name: "AForce Hydration Sticks",
    tagline: "Hydration. Focus. Daily lock-in.",
    items: ["Readiness check", "Daily protocol", "Performance goal"],
    img: "images/products/stick-berry-s10.png",
    tone: "red",
  },
  {
    time: "Midday",
    name: "AForce Drinks",
    tagline: "Energy. Endurance. Midday boost.",
    items: ["Energy support", "Hydration reminder", "Streak tracking"],
    img: "images/products/can-berry-s10.png",
    tone: "ink",
  },
  {
    time: "Evening",
    name: "AForce OS",
    tagline: "Recover. Reflect. Reset.",
    items: ["Recovery protocol", "Progress review", "Next-day prep"],
    img: "aforce-os-phone.png",
    tone: "blue",
  },
];

const LOOP = [
  { w: "Product", tone: "ink" as Tone },
  { w: "Ritual", tone: "ink" as Tone },
  { w: "Behavior", tone: "ink" as Tone },
  { w: "Retention", tone: "ink" as Tone },
  { w: "Membership", tone: "blue" as Tone },
  { w: "Advocacy", tone: "ink" as Tone },
  { w: "Scale", tone: "red" as Tone },
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
const toneBorder = (t: Tone) =>
  t === "red" ? "border-red/30" : t === "blue" ? "border-blue/30" : "border-text/12";
const toneGlow = (t: Tone) =>
  t === "red"
    ? "radial-gradient(circle, rgba(228,30,43,0.10) 0%, rgba(228,30,43,0) 70%)"
    : t === "blue"
      ? "radial-gradient(circle, rgba(47,91,255,0.11) 0%, rgba(47,91,255,0) 70%)"
      : "radial-gradient(circle, rgba(20,20,20,0.07) 0%, rgba(20,20,20,0) 70%)";

export default function CustomerJourney() {
  const reduce = useReducedMotion();
  const base = import.meta.env.BASE_URL;
  const reveal = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 } as const,
    transition: reduce ? undefined : { duration: 0.55, ease: EASE, delay },
  });

  return (
    <SlideFrame slide={13} phaseLabel="The Journey">
      {/* flow glows — warm acquisition (left) cooling into retention (right) */}
      <div
        aria-hidden
        className="absolute left-[-8vw] top-[2vh] h-[40vh] w-[40vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(228,30,43,0.08) 0%, rgba(228,30,43,0) 68%)",
        }}
      />
      <div
        aria-hidden
        className="absolute right-[-8vw] bottom-[-10vh] h-[46vh] w-[46vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(47,91,255,0.10) 0%, rgba(47,91,255,0) 68%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col px-[4.5vw] pt-[8vh] pb-[9vh]">
        {/* HEADER */}
        <div className="flex items-end justify-between gap-[4vw]">
          <div>
            <motion.span
              className="block mb-[1.6vh] font-display uppercase tracking-[0.34em] text-[0.72vw] text-red font-semibold border-b-2 border-red pb-[0.5vh] w-fit"
              {...reveal(0)}
            >
              Customer Journey
            </motion.span>
            <motion.h1
              className="font-display font-light tracking-[-0.025em] text-[2.9vw] leading-[1.02] text-text"
              {...reveal(0.08)}
            >
              From first sip to{" "}
              <span className="text-blue font-normal">membership.</span>
            </motion.h1>
          </div>

          <motion.div
            className="hidden md:flex flex-col items-end text-right pb-[0.6vh]"
            {...reveal(0.18)}
          >
            <span className="font-display uppercase tracking-[0.26em] text-[0.58vw] text-text/40 font-semibold">
              One journey
            </span>
            <span className="mt-[0.7vh] font-display font-light tracking-[-0.01em] text-[1.05vw] leading-none">
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
        <div className="mt-[3.4vh] relative">
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
                {...reveal(0.4 + si * 0.08)}
              >
                {/* hero wash behind the ritual */}
                {s.hero && (
                  <div
                    aria-hidden
                    className="absolute -left-[0.4vw] right-[1.2vw] top-[1.6vw] bottom-[-1vh] rounded-[0.4vw]"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(228,30,43,0) 0%, rgba(228,30,43,0.05) 100%)",
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
                  className={`relative z-10 mt-[2.4vh] block font-display uppercase tracking-[0.2em] text-[0.78vw] font-bold ${toneText(
                    s.tone,
                  )}`}
                >
                  <span className="text-text/30">{s.n}</span> {s.k}
                </span>

                {s.hero ? (
                  <div className="relative z-10 mt-[2.2vh]">
                    <div className="flex flex-col gap-[0.5vh]">
                      {RITUAL_WORDS.map((rw) => (
                        <span
                          key={rw}
                          className="font-display font-bold uppercase tracking-[0.01em] leading-[1.02] text-[1.7vw] text-red"
                        >
                          {rw}
                        </span>
                      ))}
                    </div>
                    <p className="mt-[1.8vh] font-body leading-[1.5] text-[0.82vw] text-text/55 max-w-[15vw]">
                      {s.sub}
                    </p>
                  </div>
                ) : (
                  <>
                    <span className="relative z-10 mt-[1.8vh] block font-display font-normal tracking-[-0.01em] leading-none text-[1.5vw] text-text">
                      {s.name}
                    </span>
                    <ul className="relative z-10 mt-[1.8vh] flex flex-col gap-[0.85vh]">
                      {s.items?.map((it) => (
                        <li
                          key={it}
                          className="flex items-baseline gap-[0.55vw] font-body text-[0.82vw] leading-[1.3] text-text/65"
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

                {/* goal chip */}
                <div className="relative z-10 mt-[2.2vh]">
                  <span
                    className={`inline-flex items-center gap-[0.4vw] rounded-full border ${toneBorder(
                      s.tone,
                    )} px-[0.8vw] py-[0.5vh] font-display font-medium tracking-[-0.005em] text-[0.86vw] leading-none ${toneText(
                      s.tone,
                    )}`}
                  >
                    <span className="text-text/35" aria-hidden>
                      →
                    </span>
                    {s.goal}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* THE AFORCE SYSTEM — PRODUCTS */}
        <motion.div className="mt-[3.6vh]" {...reveal(0.9)}>
          <div className="mb-[1.8vh] flex items-center gap-[1vw]">
            <span className="h-[2px] w-[2.4vw] bg-red" />
            <span className="font-display uppercase tracking-[0.32em] text-[0.74vw] text-text font-bold">
              The AForce System — Products
            </span>
          </div>
          <div className="grid grid-cols-3 gap-[1.5vw]">
            {PRODUCTS.map((p, pi) => (
              <motion.div
                key={p.time}
                className={`relative overflow-hidden rounded-[0.7vw] border ${toneBorder(
                  p.tone,
                )} bg-text/[0.015]`}
                {...reveal(1.0 + pi * 0.1)}
              >
                {/* soft radial glow — never a hard shadow */}
                <div
                  aria-hidden
                  className="absolute -right-[6vw] -top-[8vh] h-[26vh] w-[26vh] rounded-full"
                  style={{ background: toneGlow(p.tone) }}
                />
                <div className="relative z-10 flex items-center gap-[1.2vw] px-[1.4vw] py-[2vh]">
                  {/* product image */}
                  <div className="flex shrink-0 items-center justify-center" style={{ width: "5vw" }}>
                    <img
                      src={`${base}${p.img}`}
                      alt={p.name}
                      className="w-auto object-contain"
                      style={{
                        height: "16vh",
                        filter: "drop-shadow(0 14px 26px rgba(0,0,0,0.28))",
                      }}
                    />
                  </div>

                  {/* copy */}
                  <div className="min-w-0 flex-1">
                    <span
                      className={`block font-display uppercase tracking-[0.26em] text-[0.62vw] font-bold ${toneText(
                        p.tone,
                      )}`}
                    >
                      {p.time}
                    </span>
                    <h3 className="mt-[0.7vh] font-display font-normal tracking-[-0.01em] leading-[1.05] text-[1.15vw] text-text">
                      {p.name}
                    </h3>
                    <p className="mt-[0.8vh] font-body italic text-[0.78vw] leading-[1.35] text-text/55">
                      {p.tagline}
                    </p>
                    <ul className="mt-[1.2vh] flex flex-col gap-[0.55vh]">
                      {p.items.map((it) => (
                        <li
                          key={it}
                          className="flex items-baseline gap-[0.5vw] font-body text-[0.76vw] leading-[1.25] text-text/65"
                        >
                          <span
                            className={`mt-[0.45vh] h-[0.26vw] w-[0.26vw] shrink-0 rounded-full ${toneDot(
                              p.tone,
                            )}`}
                          />
                          {it}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* BOTTOM BAND — compounding loop + proof metrics */}
        <motion.div
          className="mt-auto pt-[2.6vh] border-t border-text/15"
          {...reveal(1.35)}
        >
          <div className="flex items-end justify-between gap-[3vw]">
            <div className="flex flex-col gap-[1.2vh]">
              <span className="font-display uppercase tracking-[0.3em] text-[0.72vw] text-red font-semibold">
                The Compounding Loop
              </span>
              <div className="flex items-baseline gap-x-[0.6vw] font-display text-[1.1vw] leading-none whitespace-nowrap">
                {LOOP.map((n, i) => (
                  <span key={n.w} className="flex items-baseline gap-x-[0.6vw]">
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
              <span className="font-display uppercase tracking-[0.3em] text-[0.72vw] text-blue font-semibold">
                Proof Metrics
              </span>
              <div className="flex items-stretch gap-[1.8vw]">
                {METRICS.map((m, i) => (
                  <div
                    key={m.v}
                    className={`flex flex-col ${i > 0 ? "pl-[1.8vw] border-l border-text/15" : ""}`}
                  >
                    <span
                      className={`font-display font-normal tracking-[-0.01em] text-[1.05vw] leading-none whitespace-nowrap ${toneText(m.tone)}`}
                    >
                      {m.v}
                    </span>
                    <span className="mt-[0.8vh] font-display uppercase tracking-[0.22em] text-[0.58vw] text-text/40 font-semibold">
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
