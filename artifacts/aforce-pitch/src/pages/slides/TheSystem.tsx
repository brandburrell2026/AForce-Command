import { motion } from "framer-motion";

import SlideFrame from "@/components/SlideFrame";

const FLOW = [
  { t: "Hydration", k: "Product" },
  { t: "Daily Use", k: "Habit" },
  { t: "Tracking", k: "OS" },
  { t: "Ritual", k: "Behavior" },
  { t: "Subscription", k: "Revenue" },
  { t: "Community", k: "Moat" },
];

export default function TheSystem() {
  return (
    <SlideFrame slide={8}>
      <div className="absolute inset-0 flex flex-col justify-center px-[5vw]">
        <div className="mb-[4vh]">
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-blue font-semibold border-b-2 border-blue pb-[0.6vh]">
            The System
          </span>
        </div>

        <h1 className="font-display font-light tracking-[-0.025em] text-[4.4vw] leading-[1.02] text-text">
          The system.
        </h1>

        <p className="mt-[2.4vh] max-w-[52vw] font-display text-[1.3vw] leading-[1.45] text-text/75">
          Products create <span className="text-red font-medium">acquisition.</span> The OS
          creates <span className="text-blue font-medium">retention.</span>
        </p>

        {/* flow */}
        <div className="mt-[7vh] flex items-stretch gap-[0.6vw]">
          {FLOW.map((n, i) => (
            <motion.div
              key={n.t}
              className="flex items-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 + i * 0.12 }}
            >
              <div className="flex flex-col items-center justify-center border border-text/20 rounded-[0.4vw] bg-bg-elev/60 px-[1.5vw] py-[2.2vh] min-w-[9vw]">
                <div className="font-display uppercase tracking-[0.22em] text-[0.55vw] text-text/40 font-medium mb-[0.8vh]">
                  {n.k}
                </div>
                <div className="font-display text-[1.15vw] text-text font-medium text-center leading-tight">
                  {n.t}
                </div>
              </div>
              {i < FLOW.length - 1 && (
                <div className="px-[0.5vw] text-text/30 font-display text-[1.2vw]">→</div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
