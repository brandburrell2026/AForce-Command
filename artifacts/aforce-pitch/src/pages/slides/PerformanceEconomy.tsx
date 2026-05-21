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
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Performance Economy
        </div>

        <h2 className="font-display text-[4.6vw] leading-[1] tracking-tighter max-w-[75vw]">
          All converging toward
          <br />
          one demand:
          <br />
          <span className="text-primary">sustained performance.</span>
        </h2>

        <div className="mt-[6vh] grid grid-cols-12 gap-[3vw] items-start">
          <div className="col-span-6">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[1.5vh]">
              Converging fields
            </div>
            <div className="flex flex-col gap-[1vh]">
              {CONVERGING.map((c) => (
                <div
                  key={c}
                  className="font-display text-[1.6vw] leading-[1.15] tracking-tight text-text/85"
                >
                  {c}
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-6 border-l border-text/10 pl-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[1.5vh]">
              AForce sits at the intersection of
            </div>
            <div className="flex flex-wrap gap-[0.6vw]">
              {INTERSECTION.map((i) => (
                <span
                  key={i}
                  className="px-[1vw] py-[0.6vh] border border-text/15 rounded-full font-body text-[0.9vw] text-text/80"
                >
                  {i}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
