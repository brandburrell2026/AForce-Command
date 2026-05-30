import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

// Pushed to the far edges — the noise the category left behind.
const FAINT = [
  { t: "RED BULL", top: "12%", left: "60%", rot: -8 },
  { t: "GHOST", top: "84%", left: "64%", rot: 6 },
  { t: "PRIME", top: "22%", left: "90%", rot: 5 },
  { t: "LMNT", top: "74%", left: "92%", rot: -6 },
];

// floor line (vh above frame bottom) — products stand here, reflections drop below.
const FLOOR = 16;

// Back row: the three sticks — set back, soft-focus, nestled in the gaps
// between the cans so each one peeks out for depth.
const STICKS = [
  { src: "stick-watermelon", h: 48, left: 0 },
  { src: "stick-soursop", h: 50, left: 30 },
  { src: "stick-berry", h: 48, left: 62 },
];

// Front row: the three cans — hero center, sharp, lit. Reflected on the floor.
const CANS = [
  { src: "can-watermelon", h: 56, left: 9, hero: false },
  { src: "can-berry", h: 64, left: 38, hero: true },
  { src: "can-soursop", h: 56, left: 70, hero: false },
];

export default function WhiteSpace() {
  const base = import.meta.env.BASE_URL;
  const reduce = useReducedMotion();
  const img = (s: string) => `${base}images/products/${s}.png`;

  return (
    <SlideFrame slide={6}>
      <div className="absolute inset-0 overflow-hidden">
        {/* faint competitor noise, banished to the edges */}
        {FAINT.map((n, i) => (
          <motion.div
            key={n.t}
            aria-hidden
            className="absolute font-display font-extrabold tracking-tight text-text whitespace-nowrap select-none"
            style={{ top: n.top, left: n.left, fontSize: "2.4vw" }}
            initial={reduce ? false : { opacity: 0, rotate: n.rot }}
            animate={
              reduce
                ? { opacity: 0.05, rotate: n.rot }
                : { opacity: 0.05, rotate: [n.rot - 1.5, n.rot + 1.5, n.rot - 1.5] }
            }
            transition={
              reduce
                ? undefined
                : {
                    opacity: { duration: 0.8, ease: EASE, delay: 0.1 },
                    rotate: { duration: 6 + i, repeat: Infinity, ease: "easeInOut" },
                  }
            }
          >
            {n.t}
          </motion.div>
        ))}

        {/* the product stage */}
        <div className="absolute right-0 bottom-0 top-0 w-[62%] z-10">
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
              reduce
                ? { opacity: 1, scale: 1 }
                : { opacity: [0.85, 1, 0.85], scale: 1 }
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
                  reduce
                    ? undefined
                    : { duration: 0.75, ease: EASE, delay: 0.3 + i * 0.1 }
                }
              />
            </div>
          ))}
        </div>

        {/* the message — one statement */}
        <div className="absolute inset-y-0 left-0 w-[44%] flex flex-col justify-center px-[5vw] z-20">
          <motion.div
            className="mb-[5vh]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
          >
            <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
              The Opening
            </span>
          </motion.div>

          <h1 className="font-display font-light tracking-[-0.025em] text-[5.6vw] leading-[1.02] text-text">
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.1 }}
            >
              The
            </motion.div>
            <motion.div
              className="text-red font-normal"
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.2 }}
            >
              white space.
            </motion.div>
          </h1>

          <motion.p
            className="mt-[4vh] max-w-[28vw] font-body text-[1.15vw] leading-[1.55] text-text/70"
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
