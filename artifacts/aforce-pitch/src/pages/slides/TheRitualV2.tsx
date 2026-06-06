import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

type Line = { word: string; tone?: "red" | "blue" };

const HEADLINE: Line[] = [
  { word: "Pause.", tone: "red" },
  { word: "Hydrate." },
  { word: "Lock in.", tone: "blue" },
  { word: "Perform." },
];

const BODY = [
  "This is not a tagline.",
  "It is the behavioral operating system.",
  "The ritual creates accountability.",
  "Accountability creates retention.",
];

// floor line (vh above frame bottom) — products stand here, reflections drop below.
const FLOOR = 16;

// Back row: the three sticks — set back, soft-focus, nestled in the gaps
// between the cans so each one peeks out for depth. New matte-black topographic
// art style, matching the cans below.
const STICKS = [
  { src: "stick-watermelon-v2", h: 48, left: 0 },
  { src: "stick-soursop-v2", h: 50, left: 30 },
  { src: "stick-berry-v2", h: 48, left: 62 },
];

// Front row: the three cans — hero center, sharp, lit. Reflected on the floor.
// New matte-black topographic edition.
const CANS = [
  { src: "can-watermelon-v2", h: 56, left: 9, hero: false },
  { src: "can-berry-v2", h: 64, left: 38, hero: true },
  { src: "can-soursop-v2", h: 56, left: 70, hero: false },
];

export default function TheRitualV2() {
  const reduce = useReducedMotion();
  const base = import.meta.env.BASE_URL;
  const img = (s: string) => `${base}images/products/${s}.png`;

  return (
    <SlideFrame slide={10}>
      <div className="absolute inset-0 overflow-hidden">
        {/* RIGHT — the product stage */}
        <div className="absolute right-0 bottom-0 top-0 w-[58%] z-0">
          {/* cinematic spotlight — a bright cone of clarity behind the hero */}
          <motion.div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              left: "10%",
              right: "0%",
              bottom: `${FLOOR - 6}vh`,
              height: "82vh",
              background:
                "radial-gradient(closest-side at 45% 60%, rgba(255,255,255,0.95), rgba(255,255,255,0.45) 48%, rgba(244,241,234,0) 76%)",
            }}
            initial={reduce ? false : { opacity: 0, scale: 0.9 }}
            animate={
              reduce ? { opacity: 1, scale: 1 } : { opacity: [0.85, 1, 0.85], scale: 1 }
            }
            transition={
              reduce
                ? undefined
                : {
                    scale: { duration: 1, ease: EASE },
                    opacity: { duration: 6, repeat: Infinity, ease: "easeInOut" },
                  }
            }
          />

          {/* glossy floor sheen the lineup stands on */}
          <div
            aria-hidden
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              bottom: 0,
              height: `${FLOOR}vh`,
              background:
                "linear-gradient(to top, rgba(255,255,255,0.55), rgba(255,255,255,0) 85%)",
            }}
          />

          {/* back row — sticks, soft-focus, receding */}
          {STICKS.map((p, i) => (
            <motion.img
              key={p.src}
              src={img(p.src)}
              alt=""
              className="absolute w-auto object-contain"
              style={{
                height: `${p.h}vh`,
                bottom: `${FLOOR + 4}vh`,
                left: `${p.left}%`,
                zIndex: 10,
                filter: "blur(1.6px) brightness(0.97)",
                opacity: 0.8,
              }}
              initial={reduce ? false : { opacity: 0, y: 26 }}
              animate={{ opacity: 0.8, y: 0 }}
              transition={reduce ? undefined : { duration: 0.7, ease: EASE, delay: 0.2 + i * 0.07 }}
            />
          ))}

          {/* front row — cans, sharp, with floor reflections */}
          {CANS.map((p, i) => (
            <div key={p.src}>
              {/* reflection */}
              <motion.img
                src={img(p.src)}
                alt=""
                aria-hidden
                className="absolute w-auto object-contain"
                style={{
                  height: `${p.h}vh`,
                  bottom: `${FLOOR - p.h}vh`,
                  left: `${p.left}%`,
                  zIndex: p.hero ? 28 : 18,
                  transform: "scaleY(-1)",
                  opacity: 0.22,
                  WebkitMaskImage:
                    "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 55%)",
                  maskImage:
                    "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 55%)",
                }}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 0.22 }}
                transition={reduce ? undefined : { duration: 0.8, ease: EASE, delay: 0.5 + i * 0.08 }}
              />
              {/* the can */}
              <motion.img
                src={img(p.src)}
                alt=""
                className="absolute w-auto object-contain"
                style={{
                  height: `${p.h}vh`,
                  bottom: `${FLOOR}vh`,
                  left: `${p.left}%`,
                  zIndex: p.hero ? 30 : 20,
                  filter: p.hero
                    ? "drop-shadow(0 26px 34px rgba(0,0,0,0.22))"
                    : "drop-shadow(0 22px 28px rgba(0,0,0,0.16))",
                }}
                initial={reduce ? false : { opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduce ? undefined : { duration: 0.75, ease: EASE, delay: 0.3 + i * 0.1 }
                }
              />
            </div>
          ))}
        </div>

        {/* LEFT — the ritual, stated plainly */}
        <div className="absolute inset-y-0 left-0 z-10 flex w-[46%] flex-col justify-center px-[5vw]">
          {/* eyebrow */}
          <motion.div
            className="mb-[3.4vh]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
          >
            <span className="font-display uppercase tracking-[0.34em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
              The Ritual
            </span>
          </motion.div>

          {/* headline — one beat per line */}
          <h1 className="font-display font-light tracking-[-0.03em] text-[5.4vw] leading-[0.98] text-text">
            {HEADLINE.map((line, i) => (
              <motion.div
                key={line.word}
                initial={reduce ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.1 + i * 0.08 }
                }
                className={
                  line.tone === "blue"
                    ? "text-blue font-normal"
                    : line.tone === "red"
                      ? "text-red font-normal"
                      : undefined
                }
              >
                {line.word}
              </motion.div>
            ))}
          </h1>

          {/* body — four short, declarative lines */}
          <motion.div
            className="mt-[4.5vh] font-body text-[1.05vw] leading-[1.7] text-text/65"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.5 }}
          >
            {BODY.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </motion.div>
        </div>
      </div>
    </SlideFrame>
  );
}
