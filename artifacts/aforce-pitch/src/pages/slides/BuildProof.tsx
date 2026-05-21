import SlideChrome from "@/components/SlideChrome";

const PROVING = [
  "Repeat purchase",
  "Subscription behavior",
  "Ecosystem engagement",
  "Onboarding scalability",
  "CAC",
  "Retention",
  "Ritual adoption",
];

export default function BuildProof() {
  return (
    <SlideChrome slide={21}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          Build Proof Before Scale
        </div>

        <h2 className="font-display text-[5vw] leading-[0.95] tracking-tighter max-w-[75vw]">
          Not awareness.
          <br />
          <span className="text-primary">Validation.</span>
        </h2>

        <div className="mt-[6vh] grid grid-cols-12 gap-[3vw] items-start">
          <div className="col-span-7">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[1.5vh]">
              We are proving
            </div>
            <div className="grid grid-cols-2 gap-x-[2vw] gap-y-[1vh]">
              {PROVING.map((p, i) => (
                <div key={p} className="flex items-baseline gap-[0.8vw]">
                  <span className="font-body text-[0.7vw] tracking-[0.4em] uppercase text-text/35 font-semibold tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-display text-[1.3vw] leading-[1.2] tracking-tight text-text/90">
                    {p}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-5 border-l border-text/10 pl-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[1.5vh]">
              Everything answers
            </div>
            <div className="font-display text-[2.2vw] leading-[1.15] tracking-tight text-text">
              Do people want this?
            </div>
            <div className="font-display text-[2.2vw] leading-[1.15] tracking-tight text-primary mt-[0.5vh]">
              Do they come back?
            </div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
