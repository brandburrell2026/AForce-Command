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
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Team & Advisors
        </div>

        <h2 className="font-display text-[5.4vw] leading-[0.95] tracking-tighter max-w-[70vw] mb-[7vh]">
          Built by people
          <br />
          <span className="text-text/45">who understand</span>
        </h2>

        <div className="grid grid-cols-3 gap-x-[2vw] gap-y-[1.5vh] max-w-[70vw]">
          {DOMAINS.map((d, i) => (
            <div
              key={d}
              className="flex items-baseline gap-[1vw] border-t border-text/15 pt-[1.5vh]"
            >
              <div className="font-body text-[0.75vw] text-text/35 tabular-nums uppercase tracking-[0.25em]">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="font-display text-[1.4vw] leading-[1.1] tracking-tight text-text">
                {d}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideChrome>
  );
}
