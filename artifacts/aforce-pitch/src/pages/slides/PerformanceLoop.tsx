import SlideChrome from "@/components/SlideChrome";

const STEPS = ["Drink", "Ritual", "Reinforcement", "Retention"];

export default function PerformanceLoop() {
  return (
    <SlideChrome slide={13}>
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Performance Loop
        </div>

        <div className="flex items-baseline gap-[1.5vw] flex-wrap mb-[8vh]">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-baseline gap-[1.5vw]">
              <div
                className={`font-display text-[5vw] leading-[0.95] tracking-tighter ${
                  i === STEPS.length - 1 ? "text-primary" : "text-text"
                }`}
              >
                {s}
              </div>
              {i < STEPS.length - 1 && (
                <div className="font-display text-[3vw] text-text/30">→</div>
              )}
            </div>
          ))}
        </div>

        <div className="max-w-[50vw]">
          <div className="font-display text-[2vw] leading-[1.2] tracking-tight">
            The loop improves with every cycle.
          </div>
          <div className="mt-[2vh] font-body text-[1.1vw] text-text/60 leading-[1.6]">
            This is not a product cycle. It is a <span className="text-text">recurring behavioral system</span>.
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
