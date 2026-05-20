import SlideChrome from "@/components/SlideChrome";

export default function HumanTruth() {
  return (
    <SlideChrome slide={2}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 30% 50%, rgba(84,120,213,0.07) 0%, transparent 70%)",
        }}
      />

      <div className="absolute inset-0 flex flex-col justify-center px-[8vw]">
        <div className="font-body uppercase tracking-[0.4em] text-[0.85vw] text-text/45 font-semibold mb-[5vh]">
          The Human Truth
        </div>

        <h2 className="font-display text-[5.4vw] leading-[0.95] tracking-tighter max-w-[70vw]">
          The best performers
          <br />
          understand this:
        </h2>

        <div className="mt-[5vh] max-w-[60vw]">
          <div className="font-display text-[3.4vw] leading-[1.1] tracking-tight text-primary">
            Performance is built
            <br />
            <span className="text-text">before the moment.</span>
          </div>
        </div>

        <div className="mt-[8vh] max-w-[50vw] grid grid-cols-2 gap-x-[3vw] gap-y-[1vh]">
          <div className="font-body text-[0.95vw] text-text/55 leading-[1.5]">— The empty gym at 5am.</div>
          <div className="font-body text-[0.95vw] text-text/55 leading-[1.5]">— The dark office before the raise.</div>
          <div className="font-body text-[0.95vw] text-text/55 leading-[1.5]">— The founder alone with the model.</div>
          <div className="font-body text-[0.95vw] text-text/55 leading-[1.5]">— The silence before execution.</div>
        </div>
      </div>
    </SlideChrome>
  );
}
