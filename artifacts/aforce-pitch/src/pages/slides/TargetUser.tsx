import SlideChrome from "@/components/SlideChrome";

const TRAITS = [
  "Operate under pressure",
  "Do not get to be off",
  "Already live with discipline",
  "Value readiness over stimulation",
  "See performance as part of identity",
];

const FOCUS = ["Finance", "Entrepreneurship", "Performance operators"];

export default function TargetUser() {
  return (
    <SlideChrome slide={17}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Target User
        </div>

        <h2 className="font-display text-[5vw] leading-[0.95] tracking-tighter max-w-[75vw]">
          High-performance
          <br />
          <span className="text-primary">professionals.</span>
        </h2>

        <div className="mt-[6vh] grid grid-cols-12 gap-[3vw] items-start">
          <div className="col-span-7">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[1.5vh]">
              People who
            </div>
            <div className="flex flex-col gap-[1vh]">
              {TRAITS.map((t) => (
                <div key={t} className="flex items-baseline gap-[0.8vw]">
                  <span className="font-display text-[0.9vw] text-primary">—</span>
                  <span className="font-display text-[1.4vw] leading-[1.2] tracking-tight text-text/90">
                    {t}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-5 border-l border-text/10 pl-[2vw] flex flex-col gap-[3vh]">
            <div>
              <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[1vh]">
                Initial focus
              </div>
              <div className="flex flex-wrap gap-[0.5vw]">
                {FOCUS.map((f) => (
                  <span
                    key={f}
                    className="px-[1vw] py-[0.6vh] border border-text/15 rounded-full font-body text-[0.9vw] text-text/80"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[0.5vh]">
                Launch market
              </div>
              <div className="font-display text-[2.4vw] leading-none tracking-tight text-accent">
                Miami / Brickell
              </div>
            </div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
