import SlideChrome from "@/components/SlideChrome";

const TRACTION = [
  { value: "$832k", label: "Raised to date", detail: "Pre-seed capital committed." },
  { value: "2.3M+", label: "Audience reached", detail: "National media exposure." },
  { value: "TV", label: "On-air feature", detail: "America's Real Deal — Feb 2027." },
  { value: "Beta", label: "Closed cohort", detail: "TestFlight live with active users." },
];

export default function Traction() {
  return (
    <SlideChrome slide={20}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Traction
        </div>

        <h2 className="font-display text-[4.6vw] leading-[0.95] tracking-tighter max-w-[70vw]">
          Actual. Committed. <span className="text-primary">Measurable.</span>
        </h2>

        <div className="mt-[2vh] font-display text-[1.3vw] leading-[1.2] tracking-tight text-text/55 max-w-[55vw]">
          No speculative numbers. No vanity metrics.
        </div>

        <div className="mt-[8vh] grid grid-cols-4 gap-[2vw] max-w-[82vw]">
          {TRACTION.map((t, i) => (
            <div key={t.value} className="border-t border-text/20 pt-[2vh]">
              <div className="font-body uppercase tracking-[0.32em] text-[0.65vw] text-text/35 font-semibold tabular-nums mb-[1.5vh]">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="font-display text-[3.8vw] leading-none tracking-tighter text-text">
                {t.value}
              </div>
              <div className="font-body uppercase tracking-[0.25em] text-[0.7vw] text-primary mt-[1.5vh] font-semibold">
                {t.label}
              </div>
              <div className="font-body text-[0.8vw] text-text/55 mt-[0.6vh] leading-[1.5]">
                {t.detail}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[7vh] font-display text-[1.4vw] leading-[1.2] tracking-tight max-w-[60vw] text-text/65">
          Momentum is <span className="text-text">already in motion.</span>
        </div>
      </div>
    </SlideChrome>
  );
}
