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

export default function TheRitual() {
  const reduce = useReducedMotion();
  const base = import.meta.env.BASE_URL;
  const photo = `${base}images/bg/16-silence-hooded2.png`;

  return (
    <SlideFrame slide={9}>
      <div className="absolute inset-0">
        {/* RIGHT — full-height portrait, bleeding off the right edge */}
        <motion.div
          className="absolute inset-y-0 right-0 w-[52%]"
          initial={reduce ? false : { opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduce ? undefined : { duration: 1.1, ease: EASE }}
        >
          <img
            src={photo}
            alt=""
            aria-hidden
            className="h-full w-full object-cover object-center"
          />
          {/* soft fade so the photo melts into the grey canvas on the left */}
          <div className="absolute inset-y-0 left-0 w-[32%] bg-gradient-to-r from-[#e7e3db] via-[#e7e3db]/60 to-transparent" />
          {/* bottom scrim keeps the shared footer chrome legible over the dark figure */}
          <div className="absolute inset-x-0 bottom-0 h-[15vh] bg-gradient-to-t from-[#d9d4cb] to-transparent" />
        </motion.div>

        {/* LEFT — the ritual, stated plainly */}
        <div className="absolute inset-y-0 left-0 z-10 flex w-[56%] flex-col justify-center px-[5vw]">
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
