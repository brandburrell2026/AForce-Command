import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

// The people who don't get to be off — each caught in the moment before
// execution. Same cinematic, desaturated treatment across the lineup.
const PEOPLE = [
  { src: "08-athlete-face", label: "Athlete", pos: "center" },
  { src: "08-ceo-woman", label: "CEO", pos: "center" },
  { src: "08-dj", label: "DJ", pos: "center" },
  { src: "08-trader-woman", label: "Trader", pos: "center" },
];

export default function WhiteSpace() {
  const base = import.meta.env.BASE_URL;
  const reduce = useReducedMotion();
  const img = (s: string) => `${base}images/bg/${s}.png`;

  return (
    <SlideFrame slide={8}>
      <div className="absolute inset-0">
        {/* RIGHT — the lineup of high-performers, a row of full-height portraits */}
        <div className="absolute inset-y-0 right-0 flex w-[64%] gap-[2px]">
          {PEOPLE.map((p, i) => (
            <motion.div
              key={p.src}
              className="relative h-full flex-1 overflow-hidden"
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduce ? undefined : { duration: 0.8, ease: EASE, delay: 0.12 + i * 0.1 }
              }
            >
              <img
                src={img(p.src)}
                alt=""
                aria-hidden
                className="h-full w-full object-cover"
                style={{ objectPosition: p.pos, filter: "grayscale(0.4) contrast(1.04)" }}
              />
              {/* bottom scrim so the label and footer chrome stay legible */}
              <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-t from-black/60 to-transparent" />
              {/* persona label — lifted clear of the shared footer chrome */}
              <div className="absolute bottom-[9.5vh] left-0 right-0 text-center">
                <span className="font-display uppercase tracking-[0.3em] text-[0.72vw] text-white/85 font-semibold">
                  {p.label}
                </span>
              </div>
            </motion.div>
          ))}
          {/* soft fade so the lineup melts into the grey canvas on the left */}
          <div className="absolute inset-y-0 left-0 w-[12%] bg-gradient-to-r from-[#e7e3db] to-transparent" />
        </div>

        {/* the message — one statement */}
        <div className="absolute inset-y-0 left-0 z-10 flex w-[40%] flex-col justify-center px-[5vw]">
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

          <h1 className="font-display font-light tracking-[-0.025em] text-[5.2vw] leading-[1.02] text-text">
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
            className="mt-[4vh] max-w-[26vw] font-body text-[1.1vw] leading-[1.55] text-text/70"
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
