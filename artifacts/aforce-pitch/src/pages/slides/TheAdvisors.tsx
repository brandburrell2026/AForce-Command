import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

type Advisor = {
  name: string;
  title: string;
  area: string;
  placeholder?: boolean;
};

const ADVISORS: Advisor[] = [
  {
    name: "Peter Ingwersen",
    title: "Former CEO, Denham / Advisor, Levi's",
    area: "Brand strategy and premium positioning",
  },
  {
    name: "Kristel van Kleef",
    title: "Performance Brand Advisor · On Running background",
    area: "Retail and go-to-market strategy",
  },
  {
    name: "[ADVISOR NAME]",
    title: "[Title]",
    area: "[Area of contribution]",
    placeholder: true,
  },
];

export default function TheAdvisors() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={5}>
      <div className="absolute inset-0 flex flex-col justify-center px-[5vw] pt-[13vh] pb-[11vh]">
        {/* header */}
        <motion.div
          className="mb-[3.5vh]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
            The Advisors
          </span>
        </motion.div>

        <motion.h1
          className="font-display font-light tracking-[-0.025em] text-[3.8vw] leading-[1.02] text-text"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
        >
          The people behind the{" "}
          <span className="text-red font-normal">people.</span>
        </motion.h1>

        <motion.p
          className="mt-[2.6vh] max-w-[48vw] font-body text-[1.05vw] leading-[1.5] text-text/65"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.18 }}
        >
          AForce is supported by operators who have built, scaled, and exited at
          the highest level.
        </motion.p>

        {/* advisor cards */}
        <div className="mt-[6vh] grid grid-cols-3 gap-[2vw]">
          {ADVISORS.map((a, i) => (
            <motion.div
              key={a.name}
              className={`flex flex-col rounded-[3px] border bg-text/[0.015] px-[1.8vw] py-[3.2vh] ${
                a.placeholder ? "border-dashed border-text/15" : "border-text/10"
              }`}
              initial={reduce ? false : { opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.3 + i * 0.12 }
              }
            >
              <span
                className={`h-[2px] w-[2.4vw] mb-[2.4vh] ${
                  a.placeholder ? "bg-text/20" : "bg-red"
                }`}
              />
              <div
                className={`font-display text-[1.6vw] font-normal leading-[1.05] ${
                  a.placeholder ? "text-text/40" : "text-text"
                }`}
              >
                {a.name}
              </div>
              <div
                className={`mt-[1.6vh] font-display text-[0.95vw] font-semibold leading-[1.35] ${
                  a.placeholder ? "text-text/40" : "text-text"
                }`}
              >
                {a.title}
              </div>
              <div
                className={`mt-[1.2vh] font-body text-[0.85vw] leading-[1.5] ${
                  a.placeholder ? "text-text/30" : "text-text/55"
                }`}
              >
                {a.area}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
