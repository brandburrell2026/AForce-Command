import SlideChrome from "@/components/SlideChrome";

const PAUSE_QUALITIES = ["Quiet", "Focused", "Controlled"];

export default function HumanTruth() {
  return (
    <SlideChrome slide={15}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 30% 50%, rgba(84,120,213,0.07) 0%, transparent 70%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[3vh]">
          The Human Truth
        </div>

        <h2 className="font-display text-[4.4vw] leading-[1.05] tracking-tight max-w-[70vw]">
          The best performers understand this:
        </h2>

        <div className="mt-[5vh] max-w-[60vw]">
          <div className="font-display text-[3.4vw] leading-[1.1] tracking-tight text-primary">
            Performance is not built in the moment.
          </div>
          <div className="font-display text-[3.4vw] leading-[1.1] tracking-tight text-text/80 mt-[1vh]">
            It is built in the <span className="text-text">ritual</span> before it.
          </div>
        </div>

        <div className="mt-[7vh] grid grid-cols-12 gap-[3vw] items-end max-w-[75vw]">
          <div className="col-span-7">
            <div className="font-body text-[1.1vw] text-text/65 leading-[1.6] max-w-[36vw]">
              There is a pause before every performance.
              <br />
              Everything has already been prepared. Now it is only about execution.
            </div>
          </div>
          <div className="col-span-5 border-l border-text/10 pl-[2vw]">
            <div className="font-body uppercase tracking-[0.32em] text-[0.7vw] text-text/40 font-semibold mb-[1vh]">
              The pause is
            </div>
            <div className="flex flex-wrap gap-[0.5vw]">
              {PAUSE_QUALITIES.map((p) => (
                <span
                  key={p}
                  className="px-[1vw] py-[0.6vh] border border-text/15 rounded-full font-body text-[0.9vw] text-text/80"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-[6vh] font-body uppercase tracking-[0.4em] text-[0.7vw] text-text/35 font-semibold">
          This is where AForce lives. · Performance is non-negotiable.
        </div>
      </div>
    </SlideChrome>
  );
}
