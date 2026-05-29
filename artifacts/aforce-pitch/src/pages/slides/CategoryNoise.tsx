import { motion } from "framer-motion";

import SlideFrame from "@/components/SlideFrame";

const NOISE = [
  { t: "MONSTER", top: "16%", left: "58%", size: "3vw", rot: -8, o: 0.16 },
  { t: "CELSIUS", top: "30%", left: "76%", size: "2.4vw", rot: 6, o: 0.2 },
  { t: "PRIME", top: "52%", left: "62%", size: "3.4vw", rot: -4, o: 0.14 },
  { t: "GHOST", top: "68%", left: "80%", size: "2.2vw", rot: 10, o: 0.18 },
  { t: "GATORADE", top: "78%", left: "56%", size: "2.8vw", rot: -6, o: 0.13 },
  { t: "RED BULL", top: "12%", left: "82%", size: "2vw", rot: 4, o: 0.15 },
];

export default function CategoryNoise() {
  return (
    <SlideFrame slide={5}>
      <div className="absolute inset-0">
        {/* the chaos — competitor wordmarks scattered, faded */}
        {NOISE.map((n) => (
          <motion.div
            key={n.t}
            className="absolute font-display font-extrabold tracking-tight text-text whitespace-nowrap select-none"
            style={{
              top: n.top,
              left: n.left,
              fontSize: n.size,
              transform: `rotate(${n.rot}deg)`,
              opacity: n.o,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: n.o }}
            transition={{ duration: 0.8, delay: 0.3 + Math.random() * 0.4 }}
          >
            {n.t}
          </motion.div>
        ))}

        {/* the message */}
        <div className="absolute inset-y-0 left-0 w-[52%] flex flex-col justify-center px-[5vw]">
          <div className="mb-[5vh]">
            <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-blue font-semibold border-b-2 border-blue pb-[0.6vh]">
              The Problem
            </span>
          </div>

          <h1 className="font-display font-light tracking-[-0.025em] text-[5.6vw] leading-[1.02] text-text">
            <div>The category</div>
            <div>is <span className="text-red font-normal">noise.</span></div>
          </h1>

          <p className="mt-[4vh] max-w-[34vw] font-display text-[1.15vw] leading-[1.5] text-text/70">
            Every brand competes for attention. Almost none compete for
            composure.
          </p>
        </div>
      </div>
    </SlideFrame>
  );
}
