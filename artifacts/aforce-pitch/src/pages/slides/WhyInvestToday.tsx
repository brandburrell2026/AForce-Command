import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

type Tone = "ink" | "red" | "blue";

const REASONS: Array<{
  title: string;
  keyword: string;
  sub: string;
  tone: Tone;
}> = [
  {
    title: "Behavioral readiness is an",
    keyword: "open category.",
    sub: "No incumbent owns the moment before execution.",
    tone: "red",
  },
  {
    title: "National validation already secured through",
    keyword: "America's Real Deal.",
    sub: "Nationally televised proof — January 2027.",
    tone: "blue",
  },
  {
    title: "Membership economics create",
    keyword: "recurring revenue.",
    sub: "The OS converts one-time buyers into members.",
    tone: "blue",
  },
  {
    title: "Proof-driven GTM.",
    keyword: "",
    sub: "Every dollar proves retention, conversion, and advocacy.",
    tone: "red",
  },
];

const toneText = (t: Tone) =>
  t === "red" ? "text-red" : t === "blue" ? "text-blue" : "text-text";

export default function WhyInvestToday() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={20}>
      {/* warm glow, lower-right */}
      <div
        aria-hidden
        className="absolute right-[-8vw] bottom-[-10vh] h-[52vh] w-[52vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(228,30,43,0.10) 0%, rgba(228,30,43,0) 70%)",
        }}
      />

      {/* header */}
      <div className="absolute top-[14vh] left-[5vw] right-[5vw]">
        <motion.div
          className="mb-[3vh]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
            Why Now
          </span>
        </motion.div>

        <motion.h1
          className="font-display font-light tracking-[-0.025em] text-[3.6vw] leading-[1.04] text-text"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
        >
          Why invest <span className="text-red font-normal">today.</span>
        </motion.h1>
      </div>

      {/* 2 x 2 reasons */}
      <div className="absolute left-[5vw] right-[5vw] top-[36vh] grid grid-cols-2 gap-x-[2.4vw] gap-y-[5vh]">
        {REASONS.map((r, i) => (
          <motion.div
            key={i}
            className="flex items-start gap-[1.4vw] border-t border-text/15 pt-[2.2vh]"
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.3 + i * 0.12 }
            }
          >
            <span className="font-display tabular-nums text-[1vw] tracking-[0.18em] text-red font-semibold shrink-0 pt-[0.5vh]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <p className="font-display font-light tracking-[-0.015em] text-[1.85vw] leading-[1.12] text-text">
                {r.title}
                {r.keyword ? (
                  <>
                    {" "}
                    <span className={`${toneText(r.tone)} font-normal`}>
                      {r.keyword}
                    </span>
                  </>
                ) : null}
              </p>
              <p className="mt-[1.4vh] font-body text-[1vw] leading-[1.4] text-text/55">
                {r.sub}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </SlideFrame>
  );
}
