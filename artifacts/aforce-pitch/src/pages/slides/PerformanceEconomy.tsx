import SlideChrome from "@/components/SlideChrome";
import Disclosure from "@/components/Disclosure";
import bgImg from "@assets/performance_eco_ecoA_neural.png";

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
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${bgImg})`,
          backgroundSize: "cover",
          backgroundPosition: "center right",
          filter: "contrast(1.12) brightness(1.02)",
          opacity: 0.78,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0.25) 75%, rgba(0,0,0,0.05) 100%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/60 font-semibold mb-[3vh]">
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
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/55 font-semibold mb-[1.5vh]">
              Converging fields
            </div>
            <div className="flex flex-col gap-[1vh]">
              {CONVERGING.map((c) => (
                <div
                  key={c}
                  className="font-display text-[1.6vw] leading-[1.15] tracking-tight text-text"
                >
                  {c}
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-6 border-l border-text/20 pl-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/55 font-semibold mb-[1.5vh]">
              AForce sits at the intersection of
            </div>
            <div className="flex flex-wrap gap-[0.6vw]">
              {INTERSECTION.map((i) => (
                <span
                  key={i}
                  className="px-[1vw] py-[0.6vh] border border-text/25 rounded-full font-body text-[0.9vw] text-text/90"
                >
                  {i}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Disclosure
        label="Market sizing"
        body="Category framing based on third-party industry research and management estimates. Market sizes are directional, not guarantees of addressable or capturable opportunity."
      />
    </SlideChrome>
  );
}
