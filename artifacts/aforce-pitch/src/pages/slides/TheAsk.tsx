import { motion, useReducedMotion } from "framer-motion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

const USE = [
  { pct: 40, label: "Product & Inventory", sub: "Launch SKUs + concierge stock", color: "bg-red" },
  { pct: 25, label: "Marketing & Activation", sub: "Brickell density + activation", color: "bg-blue" },
  { pct: 20, label: "Technology & OS", sub: "AForce OS + AI coach", color: "bg-text/80" },
  { pct: 15, label: "Team & Operations", sub: "Founders + operators", color: "bg-text/35" },
];

export default function TheAsk() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={14}>
      <div className="absolute inset-0 flex flex-col justify-center px-[5vw] pt-[12vh] pb-[10vh]">
        <motion.div
          className="mb-[3.5vh]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-blue font-semibold border-b-2 border-blue pb-[0.6vh]">
            The Ask
          </span>
        </motion.div>

        <div className="flex items-end gap-[2.5vw]">
          <motion.div
            className="font-display font-normal tracking-[0.01em] text-[8.5vw] leading-[0.82] text-text"
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.7, ease: EASE, delay: 0.08 }}
          >
            $4<span className="text-red">M</span>
          </motion.div>
          <motion.div
            className="mb-[2vh] font-body text-[1.15vw] leading-[1.55] text-text/70 max-w-[26vw]"
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.28 }}
          >
            A proof-of-concept raise. This capital funds proof of habit; the next
            round funds scale.
          </motion.div>
        </div>

        {/* use of funds — stacked bar */}
        <div className="mt-[6vh] max-w-[68vw]">
          <div className="font-display uppercase tracking-[0.22em] text-[0.68vw] text-text/40 font-medium mb-[1.8vh]">
            Use of funds
          </div>
          <div className="flex w-full h-[3.4vh] rounded-full overflow-hidden gap-[0.3vw]">
            {USE.map((u, i) => (
              <motion.div
                key={u.label}
                className={`${u.color} ${i === 0 ? "rounded-l-full" : ""} ${
                  i === USE.length - 1 ? "rounded-r-full" : ""
                }`}
                style={{ width: `${u.pct}%`, transformOrigin: "left" }}
                initial={reduce ? false : { scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={
                  reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.45 + i * 0.12 }
                }
              />
            ))}
          </div>
          <div className="mt-[2.6vh] grid grid-cols-4 gap-[2vw]">
            {USE.map((u, i) => (
              <motion.div
                key={u.label}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reduce ? undefined : { duration: 0.45, ease: EASE, delay: 0.6 + i * 0.1 }
                }
              >
                <div className="flex items-baseline gap-[0.5vw]">
                  <span className={`h-[0.7vw] w-[0.7vw] rounded-full ${u.color}`} />
                  <span className="font-display text-[1.9vw] font-light text-text tabular-nums leading-none">
                    {u.pct}%
                  </span>
                </div>
                <div className="mt-[1vh] font-display uppercase tracking-[0.16em] text-[0.65vw] text-text/60 font-medium">
                  {u.label}
                </div>
                <div className="mt-[0.6vh] font-body text-[0.78vw] leading-[1.4] text-text/45">
                  {u.sub}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          className="mt-[7vh] font-display text-[2vw] font-light tracking-[-0.02em] text-text"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 1.05 }}
        >
          Built for people who don't get{" "}
          <span className="text-red font-normal">to be off.</span>
        </motion.div>
      </div>
    </SlideFrame>
  );
}
