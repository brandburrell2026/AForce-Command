import SlideChrome from "@/components/SlideChrome";

const RTD = ["Sustained daily readiness", "Office", "Gym", "Recovery", "Performance days"];
const STICKS = ["Travel", "Portability", "Immediate correction", "Convenience"];

export default function OneSystem() {
  return (
    <SlideChrome slide={10}>
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          One System. Multiple Formats.
        </div>

        <h2 className="font-display text-[5vw] leading-[0.95] tracking-tighter max-w-[70vw] mb-[6vh]">
          One system.
          <br />
          <span className="text-text/45">Every moment.</span>
        </h2>

        <div className="grid grid-cols-2 gap-[3vw] max-w-[75vw]">
          <div>
            <div className="font-body uppercase tracking-[0.35em] text-[0.85vw] text-primary font-semibold mb-[1.5vh]">
              The RTD
            </div>
            {RTD.map((item, i) => (
              <div
                key={item}
                className={`font-${i === 0 ? "display text-[1.8vw] leading-[1.15] tracking-tight text-text mb-[1.5vh]" : "body text-[1vw] text-text/65 py-[0.6vh]"}`}
              >
                {i === 0 ? item : `— ${item}`}
              </div>
            ))}
          </div>
          <div>
            <div className="font-body uppercase tracking-[0.35em] text-[0.85vw] text-primary font-semibold mb-[1.5vh]">
              The Sticks
            </div>
            {STICKS.map((item, i) => (
              <div
                key={item}
                className={`font-${i === 0 ? "display text-[1.8vw] leading-[1.15] tracking-tight text-text mb-[1.5vh]" : "body text-[1vw] text-text/65 py-[0.6vh]"}`}
              >
                {i === 0 ? item : `— ${item}`}
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
