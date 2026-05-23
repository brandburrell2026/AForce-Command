import SlideChrome from "@/components/SlideChrome";
import PatentBadge from "@/components/PatentBadge";

const THEM = ["Sell products", "Create spikes", "Focus on stimulation"];
const US = [
  "Build retention",
  "Build recurring behavior",
  "Build ecosystem engagement",
  "Build accountability",
  "Build system intelligence",
];

export default function CompetitiveLandscape() {
  return (
    <SlideChrome slide={20}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="flex items-start justify-between mb-[3vh] gap-[2vw]">
          <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold">
            Competitive Landscape
          </div>
          <div className="flex flex-col items-end gap-[1.4vh] max-w-[28vw]">
            <div className="font-body text-[0.85vw] leading-[1.5] text-text/65 text-right">
              <span className="text-text/90 font-semibold">CPG is copied. Systems compound.</span>{" "}
              No competitor has fused product, data, and protocol into one operating system.
            </div>
            <PatentBadge />
          </div>
        </div>

        <h2 className="font-display text-[5.6vw] leading-[0.95] tracking-tighter max-w-[75vw]">
          The category has <span className="text-text/40">drinks.</span>
          <br />
          AForce has a <span className="text-primary">loop.</span>
        </h2>

        <div className="mt-[7vh] grid grid-cols-2 gap-[3vw] max-w-[75vw]">
          <div className="border-l-2 border-text/15 pl-[1.6vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[1.5vh]">
              Competitors
            </div>
            <div className="flex flex-col gap-[0.8vh]">
              {THEM.map((t) => (
                <div
                  key={t}
                  className="font-display text-[1.4vw] leading-[1.2] tracking-tight text-text/55"
                >
                  {t}
                </div>
              ))}
            </div>
          </div>

          <div className="border-l-2 border-primary pl-[1.6vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[1.5vh]">
              AForce
            </div>
            <div className="flex flex-col gap-[0.8vh]">
              {US.map((u) => (
                <div
                  key={u}
                  className="font-display text-[1.4vw] leading-[1.2] tracking-tight text-text/90"
                >
                  {u}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-[7vh] font-display text-[2vw] leading-[1.2] tracking-tight text-text">
          Behavioral system is <span className="text-primary">the moat.</span>
        </div>
      </div>
    </SlideChrome>
  );
}
