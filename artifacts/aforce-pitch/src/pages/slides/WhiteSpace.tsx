import { motion, useReducedMotion } from "framer-motion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

// The category — crossed out. Floated in the clear air above the lineup.
const FAINT = [
  { t: "RED BULL", top: "9%", left: "55%", rot: -4 },
  { t: "PRIME", top: "15%", left: "86%", rot: 3 },
  { t: "LMNT", top: "10%", left: "75%", rot: -2 },
  { t: "GHOST", top: "17%", left: "63%", rot: 4 },
];

// shared floor line (vh from frame bottom) — one clean shelf for the lineup.
const FLOOR = 13;

// Back row: the three sticks — soft-focus, receding, nestled in the gaps.
const STICKS = [
  { src: "stick-watermelon", h: 50, left: 1 },
  { src: "stick-soursop", h: 52, left: 31 },
  { src: "stick-berry", h: 50, left: 63 },
];

// Front row: the three cans — hero center, sharp and lit.
const CANS = [
  { src: "can-watermelon", h: 56, left: 9, hero: false },
  { src: "can-berry", h: 65, left: 38, hero: true },
  { src: "can-soursop", h: 56, left: 70, hero: false },
];

export default function WhiteSpace() {
  const base = import.meta.env.BASE_URL;
  const reduce = useReducedMotion();
  const img = (s: string) => `${base}images/products/${s}.png`;

  return (
    <SlideFrame slide={6}>
      <div className="absolute inset-0 overflow-hidden">
        {/* the category, crossed out — faint marks in the clear air */}
        {FAINT.map((n, i) => (
          <motion.div
            key={n.t}
            aria-hidden
            className="absolute font-display font-bold tracking-tight whitespace-nowrap select-none line-through"
            style={{
              top: n.top,
              left: n.left,
              fontSize: "1.7vw",
              color: "rgba(20,20,20,0.07)",
              textDecorationColor: "rgba(228,30,43,0.28)",
              textDecorationThickness: "0.12vw",
              transform: `rotate(${n.rot}deg)`,
            }}
            initial={reduce ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.7, ease: EASE, delay: 0.15 + i * 0.06 }}
          >
            {n.t}
          </motion.div>
        ))}

        {/* the product stage */}
        <div className="absolute right-0 bottom-0 top-0 w-[62%] z-10">
          {/* studio spotlight — a soft cone of clarity behind the hero */}
          <motion.div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              left: "4%",
              right: "-4%",
              bottom: `${FLOOR - 4}vh`,
              height: "86vh",
              background:
                "radial-gradient(closest-side at 46% 58%, rgba(255,255,255,0.98), rgba(255,255,255,0.5) 46%, rgba(244,241,234,0) 74%)",
            }}
            initial={reduce ? false : { opacity: 0, scale: 0.92 }}
            animate={
              reduce ? { opacity: 1, scale: 1 } : { opacity: [0.9, 1, 0.9], scale: 1 }
            }
            transition={
              reduce
                ? undefined
                : {
                    scale: { duration: 1, ease: EASE },
                    opacity: { duration: 7, repeat: Infinity, ease: "easeInOut" },
                  }
            }
          />

          {/* a soft group shadow seating the whole lineup on the shelf */}
          <div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              left: "2%",
              right: "2%",
              bottom: `${FLOOR - 3}vh`,
              height: "8vh",
              background:
                "radial-gradient(closest-side at 50% 100%, rgba(0,0,0,0.12), rgba(0,0,0,0) 70%)",
              filter: "blur(8px)",
            }}
          />

          {/* back row — sticks, soft-focus, receding */}
          {STICKS.map((p, i) => (
            <motion.div
              key={p.src}
              className="absolute"
              style={{ left: `${p.left}%`, bottom: `${FLOOR}vh`, zIndex: 10 }}
              initial={reduce ? false : { opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? undefined : { duration: 0.7, ease: EASE, delay: 0.2 + i * 0.07 }}
            >
              <div
                aria-hidden
                className="absolute"
                style={{
                  bottom: "-1vh",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "150%",
                  height: "4vh",
                  background:
                    "radial-gradient(closest-side, rgba(0,0,0,0.22), rgba(0,0,0,0) 72%)",
                  filter: "blur(6px)",
                }}
              />
              <img
                src={img(p.src)}
                alt=""
                className="block w-auto object-contain"
                style={{
                  height: `${p.h}vh`,
                  filter: "blur(1.8px) brightness(0.96)",
                  opacity: 0.78,
                }}
              />
            </motion.div>
          ))}

          {/* front row — cans, sharp, grounded with contact shadows */}
          {CANS.map((p, i) => (
            <motion.div
              key={p.src}
              className="absolute"
              style={{
                left: `${p.left}%`,
                bottom: `${FLOOR}vh`,
                zIndex: p.hero ? 30 : 20,
              }}
              initial={reduce ? false : { opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? undefined : { duration: 0.75, ease: EASE, delay: 0.3 + i * 0.1 }}
            >
              <div
                aria-hidden
                className="absolute"
                style={{
                  bottom: "-1.4vh",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "124%",
                  height: `${p.hero ? 6 : 5}vh`,
                  background: `radial-gradient(closest-side, rgba(0,0,0,${p.hero ? 0.34 : 0.28}), rgba(0,0,0,0) 72%)`,
                  filter: "blur(7px)",
                }}
              />
              <img
                src={img(p.src)}
                alt=""
                className="block w-auto object-contain"
                style={{
                  height: `${p.h}vh`,
                  filter: p.hero
                    ? "drop-shadow(0 18px 26px rgba(0,0,0,0.16)) brightness(1.02)"
                    : "drop-shadow(0 14px 20px rgba(0,0,0,0.12)) brightness(0.99)",
                }}
              />
            </motion.div>
          ))}
        </div>

        {/* the message — one statement */}
        <div className="absolute inset-y-0 left-0 w-[44%] flex flex-col justify-center px-[5vw] z-20">
          <motion.div
            className="mb-[5vh] flex items-center gap-[1vw]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
          >
            <span className="h-[2px] w-[3vw] bg-blue" />
            <span className="font-display uppercase tracking-[0.34em] text-[0.78vw] text-blue font-semibold">
              The Opening
            </span>
          </motion.div>

          <h1 className="font-display font-light tracking-[-0.025em] text-[5.8vw] leading-[0.98] text-text">
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.1 }}
            >
              The
            </motion.div>
            <motion.div
              className="text-blue font-normal"
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.2 }}
            >
              white space.
            </motion.div>
          </h1>

          <motion.p
            className="mt-[4.5vh] max-w-[27vw] font-body text-[1.18vw] leading-[1.55] text-text/65"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.34 }}
          >
            AForce owns the moment before execution — the one space the category
            left empty.
          </motion.p>
        </div>
      </div>
    </SlideFrame>
  );
}
