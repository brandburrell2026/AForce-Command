import SlideChrome from "@/components/SlideChrome";

const NOISE = [
  "Energy",
  "Spike",
  "Crash",
  "Hype",
  "Stimulation",
  "Overstimulation",
  "Reactive",
  "Loud",
  "Interchangeable",
  "After the fact",
];

export default function CategoryProblem() {
  return (
    <SlideChrome slide={4}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 flex flex-wrap content-start gap-x-[2vw] gap-y-[1.5vh] px-[6vw] pt-[18vh] opacity-[0.10]">
          {Array.from({ length: 6 }).flatMap((_, row) =>
            NOISE.map((w) => (
              <span
                key={`${row}-${w}`}
                className="font-display text-[2.2vw] tracking-tight text-text"
              >
                {w}
              </span>
            )),
          )}
        </div>
      </div>

      <div className="absolute inset-0 flex flex-col justify-center px-[8vw] pointer-events-none">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[4vh]">
          The Category Problem
        </div>

        <h2 className="font-display text-[4.2vw] leading-[0.95] tracking-tighter max-w-[70vw]">
          <span className="text-text/50">Most brands react</span>
          <br />
          <span className="text-text">after performance drops.</span>
        </h2>

        <div className="mt-[4vh] h-[2px] w-[10vw] bg-primary/70" />

        <div className="mt-[4vh] font-display text-[3.4vw] leading-[1] tracking-tighter max-w-[70vw]">
          AForce <span className="text-primary">prepares people</span>
          <br />
          <span className="text-text">before performance begins.</span>
        </div>

        <div className="mt-[6vh] max-w-[50vw] font-body text-[0.95vw] text-text/55 leading-[1.6]">
          The category is loud by design — chaos, overstimulation, social media noise. The frame is wrong. Performance is built before the moment, not chased after it.
        </div>
      </div>
    </SlideChrome>
  );
}
