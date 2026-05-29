import { motion, useReducedMotion } from "framer-motion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

// Pushed to the far edges — the noise the category left behind.
const FAINT = [
  { t: "MONSTER", top: "14%", left: "70%", rot: -8 },
  { t: "CELSIUS", top: "80%", left: "66%", rot: 6 },
  { t: "PRIME", top: "24%", left: "90%", rot: 5 },
  { t: "GHOST", top: "70%", left: "92%", rot: -6 },
];

export default function WhiteSpace() {
  const base = import.meta.env.BASE_URL;
  const reduce = useReducedMotion();

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
                ? { opacity: 0.06, rotate: n.rot }
                : { opacity: 0.06, rotate: [n.rot - 1.5, n.rot + 1.5, n.rot - 1.5] }
            }
            transition={
              reduce
                ? undefined
                : {
                    opacity: { duration: 0.8, ease: EASE, delay: 0.1 },
                    rotate: {
                      duration: 6 + i,
                      repeat: Infinity,
                      ease: "easeInOut",
                    },
                  }
            }
          >
            {n.t}
          </motion.div>
        ))}

        {/* the white space itself — a luminous pocket the can owns */}
        <motion.div
          aria-hidden
          className="absolute right-[8%] top-1/2 -translate-y-1/2 w-[46vw] h-[80vh] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(closest-side, rgba(255,255,255,0.85), rgba(255,255,255,0.35) 55%, rgba(244,241,234,0) 78%)",
          }}
          initial={reduce ? false : { opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduce ? undefined : { duration: 1, ease: EASE }}
        />

        {/* the single can — the clarity amid the noise */}
        <motion.img
          src={`${base}images/aforce-can.png`}
          alt="AForce"
          className="absolute right-[16%] top-1/2 h-[64vh] w-auto object-contain z-10 drop-shadow-[0_40px_50px_rgba(0,0,0,0.16)]"
          initial={reduce ? false : { opacity: 0, y: "-46%", scale: 0.96 }}
          animate={
            reduce
              ? { opacity: 1, y: "-50%" }
              : { opacity: 1, y: ["-50%", "-52%", "-50%"], scale: 1 }
          }
          transition={
            reduce
              ? undefined
              : {
                  opacity: { duration: 0.8, ease: EASE, delay: 0.2 },
                  scale: { duration: 0.8, ease: EASE, delay: 0.2 },
                  y: {
                    duration: 6,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 1,
                  },
                }
          }
        />

        {/* the message — one statement */}
        <div className="absolute inset-y-0 left-0 w-[50%] flex flex-col justify-center px-[5vw] z-20">
          <motion.div
            className="mb-[5vh]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
          >
            <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-blue font-semibold border-b-2 border-blue pb-[0.6vh]">
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
              className="text-blue font-normal"
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.2 }}
            >
              white space.
            </motion.div>
          </h1>

          <motion.p
            className="mt-[4vh] max-w-[30vw] font-body text-[1.15vw] leading-[1.55] text-text/70"
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
