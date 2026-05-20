import SlideChrome from "@/components/SlideChrome";

const FLOW = [
  "Acquisition",
  "Ritual",
  "Retention",
  "Subscription",
  "Expansion",
];

export default function GrowthModel() {
  return (
    <SlideChrome slide={27}>
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Growth Model
        </div>

        <div className="flex items-baseline gap-[1.2vw] flex-wrap mb-[7vh]">
          {FLOW.map((s, i) => (
            <div key={s} className="flex items-baseline gap-[1.2vw]">
              <div
                className={`font-display text-[3.6vw] leading-[0.95] tracking-tighter ${
                  i === FLOW.length - 1 ? "text-primary" : "text-text"
                }`}
              >
                {s}
              </div>
              {i < FLOW.length - 1 && (
                <div className="font-display text-[2.2vw] text-text/30">→</div>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-[4vw] max-w-[75vw] mb-[6vh]">
          <div className="font-display text-[2vw] leading-[1.2] tracking-tight text-text">
            Performance creates retention.
          </div>
          <div className="font-display text-[2vw] leading-[1.2] tracking-tight text-primary">
            Retention drives revenue.
          </div>
        </div>

        <div className="max-w-[65vw] space-y-[1vh]">
          <div className="font-display text-[1.5vw] leading-[1.25] tracking-tight text-text/75">
            The product creates entry.
          </div>
          <div className="font-display text-[1.5vw] leading-[1.25] tracking-tight text-text/85">
            The ritual creates behavior.
          </div>
          <div className="font-display text-[1.5vw] leading-[1.25] tracking-tight text-text">
            The OS creates <span className="text-primary">compounding value</span>.
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
