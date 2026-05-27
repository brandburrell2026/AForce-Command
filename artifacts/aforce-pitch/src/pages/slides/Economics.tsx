import SlideChrome from "@/components/SlideChrome";

const METRICS = [
  { value: "<$45", label: "CAC", note: "Within target threshold", color: "text-text" },
  { value: "20%+", label: "Subscription Conversion", note: "From core to paid tier", color: "text-blue" },
  { value: "28–32%", label: "Repeat Purchase Rate", note: "Across early cohorts", color: "text-text" },
  { value: "3.4×", label: "Projected LTV / CAC", note: "Year-one steady state", color: "text-red" },
];

const FLOW = [
  { word: "Acquisition", color: "text-text" },
  { word: "Ritual", color: "text-text" },
  { word: "Retention", color: "text-blue" },
  { word: "Subscription", color: "text-text" },
  { word: "Expansion", color: "text-red" },
];

export default function Economics() {
  return (
    <SlideChrome slide={13}>
      <div className="absolute inset-0 flex flex-col px-[5vw] pt-[16vh] pb-[12vh]">
        <div className="flex items-center gap-[1vw] mb-[3.5vh]">
          <span className="font-display uppercase tracking-[0.32em] text-[0.72vw] font-semibold text-text">
            Unit Economics & Growth
          </span>
          <span className="block h-[2px] w-[3vw] bg-red" />
        </div>

        <h2 className="font-display font-black tracking-[-0.035em] text-[5.2vw] leading-[0.92] text-text max-w-[76vw]">
          Performance creates retention. <span className="text-red">Retention drives revenue.</span>
        </h2>

        <div className="mt-[5vh] grid grid-cols-4 gap-x-[2.5vw]">
          {METRICS.map((m) => (
            <div key={m.label} className="pt-[2.5vh] border-t-2 border-text/85">
              <div className={`font-display font-black tabular-nums text-[4vw] leading-[1] tracking-[-0.04em] ${m.color}`}>
                {m.value}
              </div>
              <div className="mt-[2.2vh] font-display uppercase tracking-[0.28em] text-[0.65vw] font-semibold text-text/60">
                {m.label}
              </div>
              <div className="mt-[0.8vh] font-display text-[0.9vw] text-text/50 leading-[1.4] font-medium">
                {m.note}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-[4vh] border-t border-divider">
          <div className="font-display uppercase tracking-[0.28em] text-[0.65vw] font-semibold text-text/45 mb-[2.5vh]">
            The Growth Model
          </div>
          <div className="flex items-baseline justify-between gap-[1vw]">
            {FLOW.map((step, i) => (
              <div key={step.word} className="flex items-baseline gap-[1vw]">
                <span className={`font-display font-black text-[1.8vw] tracking-[-0.03em] ${step.color}`}>{step.word}</span>
                {i < FLOW.length - 1 && (
                  <span className="font-display text-[1.4vw] text-text/30 font-bold">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
