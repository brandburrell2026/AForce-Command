import SlideChrome from "@/components/SlideChrome";

const PROMISES = ["Energy", "Hydration", "Recovery", "Performance"];

export default function CategoryProblem() {
  return (
    <SlideChrome slide={3}>
      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Category Problem
        </div>

        <h2 className="font-display text-[5.4vw] leading-[0.95] tracking-tighter max-w-[78vw]">
          Crowded.
          <br />
          Repetitive.
          <br />
          <span className="text-primary">Interchangeable.</span>
        </h2>

        <div className="mt-[6vh] grid grid-cols-12 gap-[3vw] items-start">
          <div className="col-span-5">
            <div className="font-body uppercase tracking-[0.32em] text-[0.75vw] text-text/40 font-semibold mb-[1.5vh]">
              Every brand promises
            </div>
            <div className="flex flex-wrap gap-[0.6vw]">
              {PROMISES.map((p) => (
                <span
                  key={p}
                  className="px-[1.2vw] py-[0.7vh] border border-text/15 rounded-full font-body text-[1vw] text-text/70"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>

          <div className="col-span-7 border-l border-text/10 pl-[2vw]">
            <div className="font-body text-[1.2vw] text-text/65 leading-[1.55] max-w-[42vw]">
              Consumers no longer hear the message.
            </div>
            <div className="font-display text-[2.4vw] leading-[1.1] tracking-tight text-text mt-[1vh]">
              The category has become <span className="text-primary">noise.</span>
            </div>
            <div className="mt-[3vh] font-body text-[1vw] text-text/45 leading-[1.6] max-w-[40vw]">
              Most brands create spikes. Very few create sustained readiness.
            </div>
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
