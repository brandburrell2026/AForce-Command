import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

type Tone = "red" | "blue" | "ink";

type Comp = { brand: string; figure: string; note: string; tone: Tone };

const COMPS: Comp[] = [
  { brand: "Prime", figure: "$250M+", note: "First-year retail sales", tone: "ink" },
  {
    brand: "BodyArmor",
    figure: "$5.6B",
    note: "Coca-Cola acquisition",
    tone: "red",
  },
  { brand: "Liquid I.V.", figure: "$500M", note: "Acquired by Unilever", tone: "ink" },
  { brand: "Oatly", figure: "$10B+", note: "IPO valuation", tone: "blue" },
];

const figureTone = (t: Tone) =>
  t === "red" ? "text-red" : t === "blue" ? "text-blue" : "text-text";

export default function AcquisitionTarget() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={24}>
      {/* warm accent halo, lower-left */}
      <div
        aria-hidden
        className="absolute left-[-8vw] bottom-[-12vh] h-[52vh] w-[52vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(228,30,43,0.10) 0%, rgba(228,30,43,0) 68%)",
        }}
      />
      {/* cool accent halo, upper-right */}
      <div
        aria-hidden
        className="absolute right-[-6vw] top-[6vh] h-[42vh] w-[42vh] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(47,91,255,0.09) 0%, rgba(47,91,255,0) 70%)",
        }}
      />

      <div className="absolute inset-0 flex items-center gap-[4.5vw] px-[5vw] pt-[12vh] pb-[10vh]">
        {/* LEFT — the framing */}
        <div className="w-[37%] shrink-0">
          <motion.div
            className="mb-[3vh]"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
          >
            <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
              The Acquisition Case
            </span>
          </motion.div>

          <motion.h1
            className="font-display font-light tracking-[-0.025em] text-[3.1vw] leading-[1.04] text-text"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
          >
            Why AForce is a prime{" "}
            <span className="text-red font-normal">acquisition target.</span>
          </motion.h1>

          <motion.p
            className="mt-[3vh] font-body text-[1vw] leading-[1.6] text-text/60"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.2 }}
          >
            The biggest names in beverage and CPG don't buy products — they buy brands
            that drive behavior and own a category.
          </motion.p>

          <motion.div
            className="mt-[4vh]"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.45 }}
          >
            <span className="block w-[2.4vw] h-[2px] bg-red mb-[2vh]" />
            <p className="font-display font-medium tracking-[-0.015em] text-[1.5vw] leading-[1.15] text-text">
              Coca-Cola. Unilever. PepsiCo.
              <span className="block text-red font-semibold">
                AForce is built to be next.
              </span>
            </p>
          </motion.div>
        </div>

        {/* RIGHT — comparable exits, 2×2 */}
        <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-[1.6vw]">
          {COMPS.map((c, i) => (
            <motion.div
              key={c.brand}
              className="relative flex flex-col justify-center overflow-hidden rounded-[12px] border border-text/[0.08] bg-cream/55 px-[1.8vw] py-[2.4vh] backdrop-blur-[3px] shadow-[0_2px_18px_-13px_rgba(26,24,19,0.5)]"
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.3 + i * 0.1 }
              }
            >
              {/* tone edge accent */}
              <span
                aria-hidden
                className={`absolute inset-y-0 left-0 w-[4px] ${
                  c.tone === "red" ? "bg-red" : c.tone === "blue" ? "bg-blue" : "bg-text/25"
                }`}
              />
              <span className="font-display uppercase tracking-[0.2em] text-[0.74vw] text-text/55 font-semibold">
                {c.brand}
              </span>
              <span
                className={`mt-[1vh] font-display font-light tabular-nums leading-none text-[3vw] ${figureTone(
                  c.tone,
                )}`}
              >
                {c.figure}
              </span>
              <span className="mt-[1.4vh] font-body text-[0.82vw] leading-[1.35] text-text/55">
                {c.note}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* disclaimer */}
      <div className="absolute bottom-[8.5vh] left-0 right-0 mx-auto max-w-[64vw] text-center font-body italic text-[#aaa] text-[0.56vw] tracking-[0.05em] leading-[1.4] z-10">
        Comparable-company figures are publicly reported and shown for illustration only.
        They are not a forecast or guarantee of any AForce outcome.
      </div>
    </SlideFrame>
  );
}
