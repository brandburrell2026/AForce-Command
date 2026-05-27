import SlideChrome from "@/components/SlideChrome";

const NOISE = [
  "More products.",
  "More claims.",
  "More routines.",
  "More optimization.",
  "More content.",
  "More noise.",
];

export default function TheNoise() {
  return (
    <SlideChrome slide={2}>
      <div className="absolute inset-0 flex flex-col justify-center px-[9vw]">
        <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/45 font-medium mb-[5vh]">
          The Problem
        </div>

        <h2 className="font-display font-light text-[5vw] leading-[1.05] tracking-tight max-w-[60vw]">
          Performance has become <span className="italic text-text/65">noise.</span>
        </h2>

        <div className="mt-[7vh] grid grid-cols-2 gap-x-[6vw] gap-y-[2.4vh] max-w-[56vw]">
          {NOISE.map((line, i) => (
            <div key={line} className="flex items-baseline gap-[1.2vw]">
              <span className="font-body tabular-nums text-[0.7vw] text-text/35 tracking-[0.2em]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-display text-[1.8vw] font-light text-text/70">{line}</span>
            </div>
          ))}
        </div>

        <div className="mt-[7vh] pt-[3vh] border-t border-divider max-w-[42vw]">
          <p className="font-display text-[1.5vw] font-light text-text/80 leading-[1.35]">
            The signal is gone. The category has confused activity with readiness.
          </p>
        </div>
      </div>
    </SlideChrome>
  );
}
