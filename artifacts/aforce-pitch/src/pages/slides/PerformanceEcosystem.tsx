import SlideChrome from "@/components/SlideChrome";

const LAYERS = [
  {
    tag: "AI Coach",
    phase: "Phase 1",
    role: "Voice-led ritual reinforcement. Verdict-aware coaching after every scan.",
  },
  {
    tag: "Clutch",
    phase: "Phase 2",
    role: "Pre-performance protocol mode. Surge, recovery, lock-in sequences.",
  },
  {
    tag: "Guardian",
    phase: "Phase 3",
    role: "Predictive safety layer. Heat, depletion, overexertion intervention.",
  },
];

export default function PerformanceLayer() {
  return (
    <SlideChrome slide={14}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Building the Performance Layer
        </div>

        <h2 className="font-display text-[4.4vw] leading-[0.95] tracking-tighter max-w-[70vw] mb-[2vh]">
          A <span className="text-primary">phased</span> expansion.
        </h2>
        <div className="font-display text-[1.4vw] leading-[1.2] tracking-tight text-text/55 max-w-[60vw]">
          Not a guaranteed outcome. <span className="text-text">A directional bet on behavioral infrastructure.</span>
        </div>

        <div className="mt-[7vh] grid grid-cols-3 gap-[2vw] max-w-[80vw]">
          {LAYERS.map((l, i) => (
            <div key={l.tag} className="flex flex-col">
              <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-primary font-semibold mb-[1vh]">
                {l.phase}
              </div>
              <div className="border-t border-text/20 pt-[2vh]">
                <div className="font-display text-[2.6vw] leading-none tracking-tight text-text">
                  {l.tag}
                </div>
                <div className="font-body text-[0.9vw] text-text/60 mt-[2vh] leading-[1.55]">
                  {l.role}
                </div>
              </div>
              {i < LAYERS.length - 1 && null}
            </div>
          ))}
        </div>

        <div className="mt-[6vh] font-body text-[0.9vw] text-text/40 leading-[1.6] max-w-[55vw]">
          Each layer earns the next. Discipline before expansion.
        </div>
      </div>
    </SlideChrome>
  );
}
