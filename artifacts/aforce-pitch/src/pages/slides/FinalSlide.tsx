import SlideChrome from "@/components/SlideChrome";

export default function FinalSlide() {
  return (
    <SlideChrome slide={31} hideChrome>
      <div className="absolute inset-0 bg-black" />
      <div className="absolute inset-0 flex flex-col items-center justify-center px-[10vw] text-center">
        <div className="font-display text-[6vw] leading-[1] tracking-tighter text-text">
          Performance is
          <br />
          <span className="text-primary">non-negotiable.</span>
        </div>
        <div className="mt-[4vh] font-body text-[1.2vw] text-text/65 leading-[1.6] max-w-[50vw]">
          AForce makes sure you are always on.
        </div>

        <div className="mt-[7vh] flex flex-col items-center gap-[0.6vh]">
          <div className="font-display text-[2.2vw] tracking-tight text-primary">Pause.</div>
          <div className="font-display text-[2.2vw] tracking-tight text-text">Hydrate.</div>
          <div className="font-display text-[2.2vw] tracking-tight text-accent">Lock in.</div>
          <div className="font-display text-[2.2vw] tracking-tight text-text/70">Perform.</div>
        </div>

        <div className="mt-[8vh] max-w-[55vw]">
          <div className="font-body text-[1.05vw] text-text/55 leading-[1.6]">
            This is not a hydration brand.
          </div>
          <div className="font-display text-[1.8vw] leading-[1.2] tracking-tight text-text mt-[1vh]">
            This is a behavioral performance ecosystem.
          </div>
        </div>
      </div>

      <div className="absolute bottom-[5vh] left-[6vw] right-[6vw] flex justify-between items-center">
        <div className="font-body uppercase tracking-[0.4em] text-[0.7vw] text-text/30 font-semibold">
          AForce
        </div>
        <div className="font-body uppercase tracking-[0.4em] text-[0.7vw] text-text/30 font-semibold">
          Phase 1 · Proof of Concept · May 2026
        </div>
      </div>
    </SlideChrome>
  );
}
