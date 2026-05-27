import SlideChrome from "@/components/SlideChrome";

const METRICS = [
  { value: "<$45", label: "CAC", note: "Within target threshold" },
  { value: "20%+", label: "Subscription Conversion", note: "From core to paid tier" },
  { value: "28–32%", label: "Repeat Purchase Rate", note: "Across early cohorts" },
  { value: "3.4×", label: "Projected LTV / CAC", note: "Year-one steady state" },
];

const FLOW = ["Acquisition", "Ritual", "Retention", "Subscription", "Expansion"];

export default function Economics() {
  return (
    <SlideChrome slide={13}>
      <div className="absolute inset-0 flex flex-col px-[9vw] py-[13vh]">
        <div>
          <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/45 font-medium mb-[3vh]">
            Unit Economics & Growth
          </div>
          <h2 className="font-display font-light text-[4.2vw] leading-[1.04] tracking-tight max-w-[68vw]">
            Performance creates retention. <span className="italic text-text/75">Retention drives revenue.</span>
          </h2>
        </div>

        <div className="mt-[7vh] grid grid-cols-4 gap-x-[3vw]">
          {METRICS.map((m) => (
            <div key={m.label} className="pt-[2.5vh] border-t border-text/25">
              <div className="font-display font-light tabular-nums text-[3.8vw] leading-[1] tracking-tight">
                {m.value}
              </div>
              <div className="mt-[2.5vh] font-body uppercase tracking-[0.28em] text-[0.7vw] text-text/55 font-medium">
                {m.label}
              </div>
              <div className="mt-[1vh] font-display text-[0.95vw] italic text-text/50 leading-[1.4]">
                {m.note}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-[6vh] border-t border-divider">
          <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-medium mb-[2.5vh]">
            The Growth Model
          </div>
          <div className="flex items-baseline justify-between gap-[1vw]">
            {FLOW.map((step, i) => (
              <div key={step} className="flex items-baseline gap-[1.2vw]">
                <span className="font-display font-light text-[1.8vw] italic text-text/80">{step}</span>
                {i < FLOW.length - 1 && (
                  <span className="font-display text-[1.4vw] text-text/30">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
