import SlideChrome from "@/components/SlideChrome";

const TRAITS = [
  "Operate under pressure",
  "Do not get to be off",
  "Already live with discipline",
  "Value readiness over stimulation",
  "See performance as identity",
];

const FOCUS = ["Finance", "Entrepreneurship", "Performance Operators"];

export default function TargetUser() {
  return (
    <SlideChrome slide={17}>
      <div className="absolute inset-0 grid grid-cols-12 gap-[3vw] px-[6vw] py-[14vh]">
        <div className="col-span-7 flex flex-col justify-center">
          <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
            The Target User
          </div>
          <h2 className="font-display text-[5vw] leading-[0.95] tracking-tighter">
            High-performance
            <br />
            <span className="text-text/45">professionals.</span>
          </h2>

          <div className="mt-[5vh] max-w-[40vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/40 font-semibold mb-[1.5vh]">
              People who
            </div>
            {TRAITS.map((t) => (
              <div
                key={t}
                className="font-body text-[1.05vw] text-text/80 py-[0.7vh] border-b border-text/8"
              >
                — {t}
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-5 flex flex-col justify-center gap-[3vh]">
          <div className="border border-text/15 rounded-sm p-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-primary font-semibold mb-[1.5vh]">
              Initial focus
            </div>
            <div className="flex flex-col gap-[0.8vh]">
              {FOCUS.map((f) => (
                <div key={f} className="font-display text-[1.6vw] leading-[1.1] tracking-tight text-text">
                  {f}
                </div>
              ))}
            </div>
          </div>
          <div className="border border-primary/40 rounded-sm p-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-primary font-semibold mb-[1vh]">
              Launch market
            </div>
            <div className="font-display text-[2.6vw] leading-[1] tracking-tight text-text">
              Miami / Brickell
            </div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
