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
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw] py-[12vh]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Future
        </div>

        <h2 className="font-display text-[4.4vw] leading-[0.95] tracking-tighter mb-[2vh] max-w-[70vw]">
          Once proof is established
          <span className="text-text/40">…</span>
        </h2>

        <div className="mt-[5vh] grid grid-cols-2 gap-y-[1.2vh] gap-x-[3vw] max-w-[75vw]">
          {FUTURE.map((f, i) => (
            <div
              key={f}
              className="flex items-baseline gap-[1vw] border-t border-text/15 pt-[1.2vh]"
            >
              <div className="font-body text-[0.75vw] text-text/35 tabular-nums uppercase tracking-[0.25em]">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="font-display text-[1.5vw] leading-[1.15] tracking-tight text-text/90">
                {f}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[7vh] font-display text-[2.4vw] leading-[1.1] tracking-tight">
          <span className="text-text/55">But first:</span>{" "}
          <span className="text-primary">Prove the ritual.</span>
        </div>
      </div>
    </SlideChrome>
  );
}
