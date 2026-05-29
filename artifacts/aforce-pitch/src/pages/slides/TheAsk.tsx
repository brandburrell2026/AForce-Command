import { motion } from "framer-motion";

import SlideFrame from "@/components/SlideFrame";

const USE = [
  { pct: 40, label: "Product & Inventory", color: "bg-red" },
  { pct: 25, label: "Marketing & Activation", color: "bg-blue" },
  { pct: 20, label: "Technology & OS", color: "bg-text/80" },
  { pct: 15, label: "Team & Operations", color: "bg-text/40" },
];

export default function TheAsk() {
  return (
    <SlideFrame slide={14}>
      <div className="absolute inset-0 flex flex-col justify-center px-[5vw]">
        <div className="mb-[4vh]">
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-blue font-semibold border-b-2 border-blue pb-[0.6vh]">
            The Ask
          </span>
        </div>

        <div className="flex items-end gap-[2.5vw]">
          <div className="font-display font-light tracking-[-0.04em] text-[9vw] leading-[0.85] text-text">
            $4<span className="text-red font-normal">M</span>
          </div>
          <div className="mb-[2vh] font-display text-[1.3vw] leading-[1.4] text-text/70 max-w-[26vw]">
            A proof-of-concept raise. The capital funds proof of habit; the next
            round funds scale.
          </div>
        </div>

        {/* use of funds — stacked bar */}
        <div className="mt-[6vh] max-w-[60vw]">
          <div className="flex w-full h-[3.2vh] rounded-full overflow-hidden">
            {USE.map((u, i) => (
              <motion.div
                key={u.label}
                className={u.color}
                style={{ width: `${u.pct}%` }}
                initial={{ scaleX: 0, originX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.6, delay: 0.4 + i * 0.12, ease: [0.22, 0.61, 0.36, 1] }}
              />
            ))}
          </div>
          <div className="mt-[2.4vh] grid grid-cols-4 gap-[2vw]">
            {USE.map((u) => (
              <div key={u.label}>
                <div className="font-display text-[1.8vw] font-light text-text tabular-nums">
                  {u.pct}%
                </div>
                <div className="mt-[0.6vh] font-display uppercase tracking-[0.16em] text-[0.65vw] text-text/55 font-medium">
                  {u.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-[7vh] font-display text-[1.7vw] font-light tracking-[-0.02em] text-text">
          Built for people who don't get{" "}
          <span className="text-red font-normal">to be off.</span>
        </div>
      </div>
    </SlideFrame>
  );
}
