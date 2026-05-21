import SlideChrome from "@/components/SlideChrome";

const FUTURE = [
  "National expansion",
  "Premium retail",
  "Larger subscription base",
  "Deeper ecosystem engagement",
  "Predictive intelligence",
  "Enterprise / team systems",
  "Wearable integrations",
  "Performance identity / community",
];

export default function TheFuture() {
  return (
    <SlideChrome slide={30}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Future
        </div>

        <h2 className="font-display text-[5.4vw] leading-[0.95] tracking-tighter max-w-[70vw]">
          Once proof is established —
          <br />
          <span className="text-primary">scale.</span>
        </h2>

        <div className="mt-[6vh] grid grid-cols-4 gap-x-[2vw] gap-y-[2.5vh] max-w-[80vw]">
          {FUTURE.map((f, i) => (
            <div key={f} className="flex items-start gap-[1vw]">
              <span className="font-body text-[0.7vw] tracking-[0.4em] uppercase text-text/35 font-semibold tabular-nums mt-[0.5vh]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-display text-[1.3vw] leading-[1.2] tracking-tight text-text/90">
                {f}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-[8vh] flex items-baseline gap-[2vw]">
          <div className="font-body uppercase tracking-[0.5em] text-[0.75vw] text-text/35 font-semibold">
            But first
          </div>
          <div className="font-display text-[2.4vw] leading-none tracking-tight text-text">
            Prove the <span className="text-primary">ritual.</span>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
