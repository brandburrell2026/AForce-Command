import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

type Tone = "ink" | "red" | "blue";

const STEPS: Array<{ w: string; d: string; tone: Tone }> = [
  { w: "Product", d: "Entry point", tone: "red" },
  { w: "Ritual", d: "Behavior formed", tone: "ink" },
  { w: "Behavior", d: "Habit locked", tone: "ink" },
  { w: "OS", d: "Data compounds", tone: "blue" },
  { w: "Retention", d: "Churn eliminated", tone: "blue" },
  { w: "Membership", d: "Revenue recurring", tone: "ink" },
  { w: "Scale", d: "Moat permanent", tone: "red" },
];

const N = STEPS.length;

// Each step sits higher than the last — the line literally compounds upward.
const NODES = STEPS.map((s, i) => ({
  ...s,
  x: 6 + (i * 88) / (N - 1),
  y: 82 - (i * 56) / (N - 1),
}));

const PATH_D = NODES.map((n, i) => `${i === 0 ? "M" : "L"} ${n.x} ${n.y}`).join(" ");

const toneText = (t: Tone) =>
  t === "red" ? "text-red" : t === "blue" ? "text-blue" : "text-text";
const toneBg = (t: Tone) =>
  t === "red" ? "bg-red" : t === "blue" ? "bg-blue" : "bg-text";

export default function TheFramework() {
  const reduce = useReducedMotion();
  const base = import.meta.env.BASE_URL;
  const photo = `${base}images/bg/11-framework.png`;

  return (
    <SlideFrame slide={12}>
      <div className="absolute inset-0">
        {/* cinematic ascent — a real staircase echoing the compounding chain,
            bleeding off the lower-right and melting into the paper */}
        <motion.div
          className="absolute bottom-0 right-0 w-[46%] h-[64%]"
          initial={reduce ? false : { opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduce ? undefined : { duration: 1.2, ease: EASE, delay: 0.2 }}
        >
          <img
            src={photo}
            alt=""
            aria-hidden
            className="h-full w-full object-cover object-center"
          />
          {/* fade the left edge into the grey canvas */}
          <div className="absolute inset-y-0 left-0 w-[42%] bg-gradient-to-r from-[#e7e3db] via-[#e7e3db]/70 to-transparent" />
          {/* fade the top edge so the photo emerges out of the paper */}
          <div className="absolute inset-x-0 top-0 h-[38%] bg-gradient-to-b from-[#e7e3db] via-[#e7e3db]/55 to-transparent" />
          {/* bottom scrim keeps the shared footer chrome legible */}
          <div className="absolute inset-x-0 bottom-0 h-[24%] bg-gradient-to-t from-[#d9d4cb] to-transparent" />
        </motion.div>

        {/* header */}
        <div className="absolute top-[14vh] left-[5vw] right-[5vw]">
          <motion.div
            className="mb-[3vh]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
          >
            <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
              The Framework
            </span>
          </motion.div>

          <motion.h1
            className="font-display font-light tracking-[-0.025em] text-[3.6vw] leading-[1.04] text-text"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
          >
            Seven steps.{" "}
            <span className="text-red font-normal">One compounding system.</span>
          </motion.h1>
        </div>

        {/* the ascending chain */}
        <div className="absolute left-[5vw] right-[5vw] top-[30vh] bottom-[16vh]">
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient
                id="fw-line"
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1="0"
                x2="100"
                y2="0"
              >
                <stop offset="0%" stopColor="#1a1815" stopOpacity="0.3" />
                <stop offset="55%" stopColor="#1a1815" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#e41e2b" stopOpacity="1" />
              </linearGradient>
            </defs>
            <motion.path
              d={PATH_D}
              fill="none"
              stroke="url(#fw-line)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={reduce ? undefined : { duration: 2.4, ease: EASE, delay: 0.3 }}
            />
          </svg>

          {/* node labels */}
          {NODES.map((n, i) => {
            const isLast = i === N - 1;
            return (
              <motion.div
                key={n.w}
                className="absolute flex flex-col items-center text-center whitespace-nowrap"
                style={{
                  left: `${n.x}%`,
                  top: `${n.y}%`,
                  transform: "translate(-50%, calc(-100% - 1.6vh))",
                }}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.5 + i * 0.18 }
                }
              >
                <span className="font-display tabular-nums text-[0.62vw] tracking-[0.22em] text-red font-semibold">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={`mt-[0.6vh] font-display tracking-[-0.01em] leading-none ${
                    isLast ? "text-[1.8vw] font-normal" : "text-[1.25vw] font-light"
                  } ${toneText(n.tone)}`}
                >
                  {n.w}
                </span>
                <span className="mt-[0.9vh] font-body uppercase tracking-[0.18em] text-[0.55vw] text-text/45 font-medium">
                  {n.d}
                </span>
              </motion.div>
            );
          })}

          {/* node dots, sitting on the line */}
          {NODES.map((n, i) => {
            const isLast = i === N - 1;
            return (
              <div
                key={`dot-${n.w}`}
                className="absolute"
                style={{ left: `${n.x}%`, top: `${n.y}%`, transform: "translate(-50%, -50%)" }}
              >
                <motion.span
                  className={`block rounded-full ${toneBg(n.tone)}`}
                  style={{ width: isLast ? "1vw" : "0.6vw", height: isLast ? "1vw" : "0.6vw" }}
                  initial={reduce ? false : { scale: 0 }}
                  animate={
                    isLast && !reduce ? { scale: [1, 1.25, 1] } : { scale: 1 }
                  }
                  transition={
                    isLast && !reduce
                      ? { duration: 1.8, ease: "easeInOut", repeat: Infinity, delay: 2.4 }
                      : reduce
                        ? undefined
                        : { duration: 0.4, ease: EASE, delay: 0.5 + i * 0.18 }
                  }
                />
                {isLast && !reduce && (
                  <motion.span
                    aria-hidden
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-red"
                    style={{ width: "1vw", height: "1vw" }}
                    animate={{ scale: [1, 2.6], opacity: [0.6, 0] }}
                    transition={{ duration: 2, ease: "easeOut", repeat: Infinity, delay: 2.4 }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* the law */}
        <motion.div
          className="absolute bottom-[8vh] left-0 right-0 text-center font-body italic text-text/55 text-[0.95vw] tracking-[0.04em]"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 2.6 }}
        >
          Each step earns the next. None can be skipped.
        </motion.div>
      </div>
    </SlideFrame>
  );
}
