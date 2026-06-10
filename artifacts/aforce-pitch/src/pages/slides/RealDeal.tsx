import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

// The funnel, told as a story: hundreds reviewed, one selected, on air soon.
const STATS: Array<{ v: string; k: string; accent?: boolean }> = [
  { v: "100s", k: "Companies reviewed" },
  { v: "1", k: "Selected", accent: true },
  { v: "Jan 2027", k: "On national television" },
];

export default function RealDeal() {
  const base = import.meta.env.BASE_URL;
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={5}>
      {/* spotlight glow behind the validation mark */}
      <div
        aria-hidden
        className="absolute top-1/2 right-[3vw] -translate-y-1/2 w-[36vw] h-[36vw] z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at center, rgba(228,30,43,0.11) 0%, rgba(228,30,43,0) 62%)",
        }}
      />

      {/* America's Real Deal logo — the validation mark */}
      <motion.img
        src={`${base}images/brand/americas-real-deal.png`}
        alt="America's Real Deal"
        className="absolute top-1/2 right-[7vw] -translate-y-1/2 w-[17vw] h-auto z-0"
        initial={reduce ? false : { opacity: 0, scale: 0.86 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: [0, -8, 0] }}
        transition={
          reduce
            ? undefined
            : {
                opacity: { duration: 0.8, ease: EASE, delay: 0.2 },
                scale: { duration: 0.8, ease: EASE, delay: 0.2 },
                y: { duration: 6, ease: "easeInOut", repeat: Infinity, delay: 1 },
              }
        }
      />

      <div className="absolute inset-0 flex flex-col justify-center px-[5vw] pr-[30vw]">
        {/* eyebrow + live broadcast badge */}
        <motion.div
          className="mb-[4vh] flex items-center gap-[1.4vw]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
            Validation
          </span>
          <span className="flex items-center gap-[0.5vw] rounded-full border border-red/40 bg-red/5 px-[0.9vw] py-[0.5vh]">
            <motion.span
              aria-hidden
              className="block rounded-full bg-red"
              style={{ width: "0.5vw", height: "0.5vw" }}
              animate={reduce ? undefined : { opacity: [1, 0.3, 1], scale: [1, 1.35, 1] }}
              transition={
                reduce ? undefined : { duration: 1.4, ease: "easeInOut", repeat: Infinity }
              }
            />
            <span className="font-display uppercase tracking-[0.28em] text-[0.62vw] text-red font-semibold">
              On Air
            </span>
          </span>
        </motion.div>

        <h1 className="font-display font-light tracking-[-0.025em] text-[5.4vw] leading-[1.02] text-text max-w-[80%]">
          <motion.span
            className="block"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
          >
            Selected for
          </motion.span>
          <motion.span
            className="block text-red font-normal"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.18 }}
          >
            America's Real Deal.
          </motion.span>
        </h1>

        <motion.p
          className="mt-[4vh] max-w-[44vw] font-body text-[1.15vw] leading-[1.55] text-text/70"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.3 }}
        >
          Chosen from hundreds of companies for a nationally televised
          investment platform. This raise builds the proof we walk in with.
        </motion.p>

        {/* dramatic funnel stat strip */}
        <div className="mt-[6vh] flex items-stretch gap-[3vw]">
          {STATS.map((s, i) => (
            <motion.div
              key={s.k}
              className="flex flex-col"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.45 + i * 0.1 }
              }
            >
              <span className={`h-[2px] w-[2.4vw] ${s.accent ? "bg-red" : "bg-text/30"}`} />
              <span
                className={`mt-[1.6vh] font-display font-light tracking-[-0.02em] leading-none text-[3.4vw] ${
                  s.accent ? "text-red" : "text-text"
                }`}
              >
                {s.v}
              </span>
              <span className="mt-[1.4vh] font-display uppercase tracking-[0.24em] text-[0.62vw] text-text/50 font-medium whitespace-nowrap">
                {s.k}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
