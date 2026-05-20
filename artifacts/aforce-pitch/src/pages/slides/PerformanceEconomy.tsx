import SlideChrome from "@/components/SlideChrome";

const CONVERGING = [
  "Functional beverages",
  "Hydration systems",
  "Behavioral coaching",
  "Performance optimization",
];

const INTERSECTION = ["Product", "Behavior", "Data", "Ritual", "Accountability", "Retention"];

export default function PerformanceEconomy() {
  return (
    <SlideChrome slide={19}>
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Performance Economy
        </div>

        <div className="grid grid-cols-2 gap-[5vw] mb-[6vh] max-w-[80vw]">
          {CONVERGING.map((c) => (
            <div
              key={c}
              className="font-display text-[2.6vw] leading-[1.05] tracking-tight text-text/85 border-t border-text/15 pt-[1.5vh]"
            >
              {c}
            </div>
          ))}
        </div>

        <div className="max-w-[60vw] mb-[6vh]">
          <div className="font-body text-[1.1vw] text-text/60 leading-[1.6]">
            All converging toward one demand:
          </div>
          <div className="mt-[1vh] font-display text-[3vw] leading-[1.05] tracking-tighter text-text">
            Sustained <span className="text-primary">performance.</span>
          </div>
        </div>

        <div>
          <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/40 font-semibold mb-[1.5vh]">
            AForce sits at the intersection of
          </div>
          <div className="flex flex-wrap gap-[0.6vw] max-w-[70vw]">
            {INTERSECTION.map((i) => (
              <span
                key={i}
                className="px-[1.2vw] py-[0.7vh] border border-text/15 rounded-full font-body text-[0.9vw] text-text/80"
              >
                {i}
              </span>
            ))}
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
