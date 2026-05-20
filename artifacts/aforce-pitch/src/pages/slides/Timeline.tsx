import SlideChrome from "@/components/SlideChrome";

const VERTICALS = [
  {
    tag: "NCAA",
    role: "Team-level readiness, hydration discipline, recovery cohort dashboards.",
  },
  {
    tag: "Pro Sports",
    role: "Pre-game protocol, performance lock-in, individualized profiles.",
  },
  {
    tag: "Enterprise",
    role: "Operator wellness, sustained execution, retention systems.",
  },
  {
    tag: "Tactical",
    role: "First responders, military, extreme-environment performance.",
  },
];

export default function PerformanceAtScale() {
  return (
    <SlideChrome slide={15}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Performance at Scale
        </div>

        <h2 className="font-display text-[4.4vw] leading-[0.95] tracking-tighter max-w-[68vw]">
          Same loop.
          <br />
          <span className="text-primary">Different environments.</span>
        </h2>

        <div className="mt-[2vh] font-display text-[1.3vw] leading-[1.2] tracking-tight text-text/55 max-w-[55vw]">
          Phase 2+ expansion — narrative elasticity, not promise.
        </div>

        <div className="mt-[7vh] grid grid-cols-4 gap-[1.5vw] max-w-[80vw]">
          {VERTICALS.map((v, i) => (
            <div
              key={v.tag}
              className="border-t border-text/20 pt-[2vh]"
            >
              <div className="font-body uppercase tracking-[0.32em] text-[0.65vw] text-text/35 font-semibold tabular-nums mb-[1.2vh]">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="font-display text-[1.9vw] leading-none tracking-tight text-text">
                {v.tag}
              </div>
              <div className="font-body text-[0.82vw] text-text/55 mt-[1.5vh] leading-[1.5]">
                {v.role}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[7vh] font-display text-[1.4vw] leading-[1.2] tracking-tight max-w-[60vw]">
          <span className="text-text/55">But proof first.</span>{" "}
          <span className="text-primary">Brickell before NCAA.</span>
        </div>
      </div>
    </SlideChrome>
  );
}
