import SlideChrome from "@/components/SlideChrome";

const PILLARS = [
  "Recurring engagement",
  "Accountability",
  "Retention",
  "Optimization",
  "Ecosystem adoption",
];

export default function CategoryShift() {
  return (
    <SlideChrome slide={5}>
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Category Shift
        </div>

        <h2 className="font-display text-[5vw] leading-[0.95] tracking-tighter max-w-[75vw]">
          AForce is <span className="text-text/40">not</span> a hydration brand.
        </h2>
        <h2 className="font-display text-[5vw] leading-[0.95] tracking-tighter mt-[2vh] max-w-[75vw]">
          It is a <span className="text-primary">behavioral performance ecosystem</span>.
        </h2>

        <div className="mt-[6vh] grid grid-cols-12 gap-[3vw] items-start">
          <div className="col-span-5">
            <div className="font-body uppercase tracking-[0.35em] text-[0.75vw] text-text/40 font-semibold mb-[1.5vh]">
              Entry point
            </div>
            <div className="font-display text-[2vw] tracking-tight text-text/85">
              Hydration.
            </div>
          </div>
          <div className="col-span-7 border-l border-text/10 pl-[2.5vw]">
            <div className="font-body uppercase tracking-[0.35em] text-[0.75vw] text-primary font-semibold mb-[1.5vh]">
              The larger opportunity
            </div>
            <div className="grid grid-cols-2 gap-y-[1.2vh] gap-x-[2vw]">
              {PILLARS.map((p) => (
                <div
                  key={p}
                  className="font-body text-[1.05vw] text-text/85"
                >
                  — {p}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-[6vh] max-w-[60vw]">
          <div className="font-display text-[1.5vw] leading-[1.3] tracking-tight text-text/70">
            Others react after performance drops.
            <br />
            <span className="text-text">AForce prepares people before performance begins.</span>
          </div>
          <div className="mt-[2vh] font-body text-[1vw] text-text/55 italic">
            Where competitors sell moments, AForce builds readiness.
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
