import { motion, useReducedMotion } from "framer-motion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

type Beat = {
  idx: string;
  word: string;
  note: string;
  tone: string;
  dot: string;
  active?: boolean;
};

// The four beats of the ritual. "Hydrate" is the live beat — it's the
// command on the glass to the right (HYDRATE NOW), so it carries the
// blue accent and the LIVE tag that ties the words to the product.
const BEATS: Beat[] = [
  { idx: "01", word: "Pause", note: "Stop the noise", tone: "text-red", dot: "bg-red" },
  {
    idx: "02",
    word: "Hydrate",
    note: "Start with water",
    tone: "text-blue",
    dot: "bg-blue",
    active: true,
  },
  { idx: "03", word: "Lock in", note: "Set the intent", tone: "text-text", dot: "bg-text/25" },
  { idx: "04", word: "Perform", note: "Execute clean", tone: "text-text", dot: "bg-text/25" },
];

export default function TheRitual() {
  const base = import.meta.env.BASE_URL;
  const reduce = useReducedMotion();
  const phone = `${base}recovery-coach-phone.png`;

  return (
    <SlideFrame slide={7}>
      <div className="absolute inset-0 overflow-hidden">
        {/* ── LEFT — the four beats, the hero ─────────────────────────── */}
        <div className="absolute inset-y-0 left-0 w-[52%] flex flex-col justify-center px-[5.5vw] z-20">
          {/* eyebrow */}
          <motion.div
            className="mb-[4.5vh] flex items-center gap-[1vw]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
          >
            <span className="h-[2px] w-[3vw] bg-blue" />
            <span className="font-display uppercase tracking-[0.34em] text-[0.78vw] text-blue font-semibold">
              The Ritual
            </span>
          </motion.div>

          {/* the beats — a vertical sequence in time */}
          <div className="relative max-w-[36vw]">
            {/* the spine */}
            <motion.span
              aria-hidden
              className="absolute left-[0.55vw] top-[1.4vh] bottom-[1.4vh] w-px bg-text/15 origin-top"
              initial={reduce ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={reduce ? undefined : { duration: 0.7, ease: EASE, delay: 0.2 }}
            />

            <div className="flex flex-col gap-[3vh]">
              {BEATS.map((beat, i) => (
                <motion.div
                  key={beat.word}
                  className="flex items-center gap-[1.5vw]"
                  initial={reduce ? false : { opacity: 0, x: -18 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={
                    reduce ? undefined : { duration: 0.45, ease: EASE, delay: 0.24 + i * 0.08 }
                  }
                >
                  {/* node */}
                  <span className="relative shrink-0 z-10 flex items-center justify-center w-[1.1vw]">
                    {beat.active && !reduce && (
                      <motion.span
                        aria-hidden
                        className="absolute h-[1.1vw] w-[1.1vw] rounded-full bg-blue/30"
                        animate={{ scale: [1, 2.1, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                      />
                    )}
                    <span
                      className={`h-[0.7vw] w-[0.7vw] rounded-full ring-4 ring-bg ${beat.dot}`}
                    />
                  </span>

                  {/* word + index + note */}
                  <div className="flex items-baseline gap-[1vw]">
                    <span className="font-display uppercase tracking-[0.3em] text-[0.7vw] text-text/35 font-semibold tabular-nums">
                      {beat.idx}
                    </span>
                    <span
                      className={`font-display font-light tracking-[-0.03em] text-[3.1vw] leading-[0.92] ${beat.tone}`}
                    >
                      {beat.word}
                    </span>
                    <span className="font-body text-[0.92vw] text-text/45 leading-none">
                      {beat.note}
                    </span>
                    {beat.active && (
                      <span className="ml-[0.2vw] flex items-center gap-[0.4vw] rounded-full border border-blue/40 px-[0.7vw] py-[0.4vh]">
                        <span className="h-[0.42vw] w-[0.42vw] rounded-full bg-blue" />
                        <span className="font-display uppercase tracking-[0.24em] text-[0.56vw] text-blue font-semibold">
                          Live
                        </span>
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* one supporting thought */}
          <motion.p
            className="mt-[6vh] max-w-[31vw] font-body text-[1.1vw] leading-[1.55] text-text/60"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.62 }}
          >
            One behavior, four beats — running live in the app. The system that turns hydration
            into readiness.
          </motion.p>
        </div>

        {/* ── RIGHT — the ritual, made real on the glass ──────────────── */}
        <div className="absolute right-0 top-0 bottom-0 w-[48%] z-10 flex items-center justify-center">
          {/* soft radial glow behind the device */}
          <motion.div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              top: "50%",
              left: "50%",
              width: "60vh",
              height: "60vh",
              transform: "translate(-50%,-52%)",
              background:
                "radial-gradient(closest-side, rgba(47,91,255,0.14), rgba(255,255,255,0.55) 44%, rgba(244,241,234,0) 72%)",
            }}
            initial={reduce ? false : { opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { opacity: [0.8, 1, 0.8] }}
            transition={
              reduce ? undefined : { opacity: { duration: 7, repeat: Infinity, ease: "easeInOut" } }
            }
          />

          {/* contact shadow */}
          <div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              bottom: "8vh",
              left: "50%",
              transform: "translateX(-50%)",
              width: "26vh",
              height: "5.5vh",
              background: "radial-gradient(closest-side, rgba(0,0,0,0.22), rgba(0,0,0,0) 72%)",
              filter: "blur(9px)",
            }}
          />

          {/* the device */}
          <motion.img
            src={phone}
            alt="AForce OS — Recovery Coach issuing the HYDRATE NOW command"
            className="relative w-auto object-contain"
            style={{
              height: "84vh",
              filter: "drop-shadow(0 30px 52px rgba(0,0,0,0.30))",
            }}
            initial={reduce ? false : { opacity: 0, x: 46, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={reduce ? undefined : { duration: 0.85, ease: EASE, delay: 0.3 }}
          />
        </div>
      </div>
    </SlideFrame>
  );
}
