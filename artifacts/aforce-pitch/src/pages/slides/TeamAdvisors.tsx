import SlideChrome from "@/components/SlideChrome";

const DOMAINS = [
  "Pressure",
  "Scaling",
  "Performance",
  "Behavior",
  "Global brand building",
  "Retention systems",
  "Recurring consumer ecosystems",
];

export default function TeamAdvisors() {
  return (
    <SlideChrome slide={16}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Team & Advisors
        </div>

        <h2 className="font-display text-[4.6vw] leading-[1.02] tracking-tighter max-w-[75vw]">
          Built by people who
          <br />
          <span className="text-primary">understand pressure.</span>
        </h2>

        <div className="mt-[7vh] max-w-[80vw]">
          <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/40 font-semibold mb-[2vh]">
            Domain expertise
          </div>
          <div className="grid grid-cols-4 gap-x-[2vw] gap-y-[2vh]">
            {DOMAINS.map((d, i) => (
              <div key={d} className="flex items-baseline gap-[0.8vw]">
                <span className="font-body text-[0.7vw] tracking-[0.4em] uppercase text-text/35 font-semibold tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-display text-[1.3vw] leading-[1.2] tracking-tight text-text/90">
                  {d}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
