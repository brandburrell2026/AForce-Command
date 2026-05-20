import SlideChrome from "@/components/SlideChrome";

const COMPETITORS = ["Sell products", "Create spikes", "Focus on stimulation"];
const AFORCE = [
  "Builds retention",
  "Builds recurring behavior",
  "Builds ecosystem engagement",
  "Builds accountability",
  "Builds system intelligence",
];

export default function CompetitiveLandscape() {
  return (
    <SlideChrome slide={20}>
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw] py-[12vh]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Competitive Landscape
        </div>

        <h2 className="font-display text-[5.4vw] leading-[0.95] tracking-tighter mb-[6vh] max-w-[70vw]">
          The category has drinks.
          <br />
          <span className="text-primary">AForce has a loop.</span>
        </h2>

        <div className="grid grid-cols-2 gap-[3vw] max-w-[80vw]">
          <div className="border border-text/12 rounded-sm p-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/40 font-semibold mb-[2vh]">
              Competitors
            </div>
            {COMPETITORS.map((c) => (
              <div
                key={c}
                className="font-body text-[1.05vw] text-text/65 py-[0.8vh] border-b border-text/8"
              >
                — {c}
              </div>
            ))}
          </div>
          <div className="border border-primary/40 rounded-sm p-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-primary font-semibold mb-[2vh]">
              AForce
            </div>
            {AFORCE.map((a) => (
              <div
                key={a}
                className="font-body text-[1.05vw] text-text py-[0.8vh] border-b border-text/8"
              >
                — {a}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-[5vh] font-display text-[2vw] tracking-tight text-text">
          Behavioral system is <span className="text-primary">the moat</span>.
        </div>
      </div>
    </SlideChrome>
  );
}
