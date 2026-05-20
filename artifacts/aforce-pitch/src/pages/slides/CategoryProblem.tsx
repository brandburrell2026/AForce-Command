import SlideChrome from "@/components/SlideChrome";

const PROMISES = ["Energy", "Hydration", "Recovery", "Performance"];

export default function CategoryProblem() {
  return (
    <SlideChrome slide={3}>
      <div className="absolute inset-0 flex flex-col justify-center px-[6vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-primary font-semibold mb-[3vh]">
          The Category Problem
        </div>
        <h2 className="font-display text-[5.2vw] leading-[0.95] tracking-tighter max-w-[70vw]">
          Crowded. Repetitive.
          <br />
          <span className="text-text/45">Interchangeable.</span>
        </h2>

        <div className="mt-[7vh] grid grid-cols-4 gap-[1.5vw] max-w-[60vw]">
          {PROMISES.map((p) => (
            <div
              key={p}
              className="border border-text/10 rounded-sm py-[3vh] text-center"
            >
              <div className="font-body uppercase tracking-[0.35em] text-[0.75vw] text-text/40 font-semibold mb-[1vh]">
                Every brand promises
              </div>
              <div className="font-display text-[1.5vw] tracking-tight text-text/85">
                {p}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[7vh] max-w-[55vw]">
          <div className="font-display text-[1.8vw] leading-[1.2] tracking-tight text-text">
            Consumers no longer hear the message.
          </div>
          <div className="font-display text-[1.8vw] leading-[1.2] tracking-tight text-text/45 mt-[1vh]">
            The category has become noise.
          </div>
          <div className="mt-[3vh] font-body text-[1vw] text-text/55 leading-[1.5]">
            Most brands create spikes. Very few create sustained readiness.
          </div>
        </div>
      </div>
    </SlideChrome>
  );
}
