import SlideChrome from "@/components/SlideChrome";

const NOISE = ["More products.", "More claims.", "More routines.", "More optimization.", "More content.", "More noise."];

export default function TheNoise() {
  return (
    <SlideChrome slide={2}>
      <div className="absolute inset-0 grid grid-cols-12 px-[5vw] pt-[16vh] pb-[12vh] gap-x-[4vw]">
        <div className="col-span-7">
          <div className="flex items-center gap-[1vw] mb-[3.5vh]">
            <span className="font-display uppercase tracking-[0.32em] text-[0.72vw] font-semibold text-text">
              The Problem
            </span>
            <span className="block h-[2px] w-[3vw] bg-red" />
          </div>

          <h2 className="font-display font-black tracking-[-0.035em] text-[7vw] leading-[0.92] text-text">
            Performance<br />
            has become<br />
            <span className="text-red">noise.</span>
          </h2>

          <p className="mt-auto pt-[5vh] font-display text-[1.4vw] font-medium text-text/75 leading-[1.35] max-w-[36vw]">
            The signal is gone. The category has confused activity with readiness.
          </p>
        </div>

        <div className="col-span-5 flex flex-col justify-center">
          <div className="font-display uppercase tracking-[0.28em] text-[0.65vw] font-semibold text-text/45 mb-[3vh]">
            The Category Today
          </div>
          <div className="grid grid-cols-1 gap-[1.6vh]">
            {NOISE.map((line, i) => (
              <div key={line} className="flex items-baseline gap-[1.2vw] border-b border-divider pb-[1.4vh]">
                <span className="font-display tabular-nums text-[0.7vw] text-text/35 tracking-[0.2em] font-semibold">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-display text-[1.8vw] text-text font-semibold">{line}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
