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
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-primary font-semibold mb-[3vh]">
          Build Proof Before Scale
        </div>

        <h2 className="font-display text-[5.2vw] leading-[0.95] tracking-tighter max-w-[70vw]">
          The first phase is not about awareness.
        </h2>
        <h2 className="font-display text-[5.2vw] leading-[0.95] tracking-tighter mt-[1vh] max-w-[70vw]">
          <span className="text-primary">It is about validation.</span>
        </h2>

        <div className="mt-[7vh] grid grid-cols-12 gap-[3vw]">
          <div className="col-span-6">
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/40 font-semibold mb-[1.5vh]">
              We are proving
            </div>
            <div className="grid grid-cols-2 gap-y-[0.7vh] gap-x-[1.5vw]">
              {PROVING.map((p) => (
                <div key={p} className="font-body text-[1vw] text-text/80">
                  — {p}
                </div>
              ))}
            </div>
          </div>
          <div className="col-span-6 border-l border-text/15 pl-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/40 font-semibold mb-[1.5vh]">
              Everything before the TV appearance exists to answer
            </div>
            <div className="font-display text-[2.4vw] leading-[1.15] tracking-tight text-text">
              Do people want this?
            </div>
            <div className="font-display text-[2.4vw] leading-[1.15] tracking-tight text-primary mt-[0.5vh]">
              Do they come back?
            </div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
